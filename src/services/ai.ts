import * as FileSystem from 'expo-file-system/legacy';
import { saveAiAnalysis } from '../db/queries';
import { getApiKey } from '../store/settingsStore';
import { AiAnalysisParsed, AiProvider } from '../types/models';

export type BeanAnalysisPhotoInput = {
  id: string;
  uri: string;
  photoType: string;
  label?: string;
};

export type BeanAnalysisMode = 'new_product' | 'existing_product_lot';

export type BrewLogPhotoAnalysisParsed = {
  grind_size_external: number | null;
  actual_dose_gram: number | null;
  yield_gram: number | null;
  brew_seconds: number | null;
  first_drip_seconds: number | null;
  preinfusion_seconds: number | null;
  dose_level: 'under' | 'ideal' | 'a_bit_more' | 'over' | 'unknown' | null;
  pressure_zone: 'low' | 'espresso_range' | 'high' | 'unknown' | null;
  used_a_bit_more: boolean | null;
  used_razor_trim: boolean | null;
  shot_result: string | null;
  channeling: 'none' | 'suspected' | 'visible' | null;
  visible_text_summary: string | null;
  uncertain_fields: string[];
  warnings: string[];
};

const buildAnalysisPrompt = (photos: BeanAnalysisPhotoInput[], mode: BeanAnalysisMode) => `You are extracting coffee bean information from package photos for a Breville BES876 coffee logging app.
Return only valid JSON in Korean. Use only visible information from the images. Do not guess missing fields.

Mode: ${mode === 'existing_product_lot' ? 'existing_product_lot. The coffee product already exists. Extract only lot/purchase/date/inventory fields. Do not suggest overwriting product identity fields unless they are visibly needed for warning/conflict evidence.' : 'new_product. Extract product identity fields and first lot fields.'}

You may receive multiple photos of the same coffee bag. Photo metadata:
${photos.map((photo, index) => `- photo_${index + 1}: id=${photo.id}, type=${photo.photoType}, label=${photo.label ?? photo.photoType}`).join('\n')}

Rules:
- If photos may not be from the same coffee product, add a warning.
- Dates must be classified as roast_date, expiry_date, or unknown_dates.
- If a date is visible but its meaning is unclear, do not force it into roast_date.
- Front/package photos are strongest for bean name and roastery.
- Date label photos are strongest for roast date and expiry date.
- Detail/back photos are strongest for origin, process, variety, tasting notes, and weight.
- Receipt or shop screenshots are strongest for purchase_date, seller, and price.
- If two photos conflict, add a conflict and do not silently choose.
- Preserve useful visible text in visible_text_summary.
- Use ISO date format YYYY-MM-DD when possible.
- Put ambiguous fields in uncertain_fields.`;

const buildBrewLogAnalysisPrompt = (photos: BeanAnalysisPhotoInput[], doseMode: 'auto' | 'manual') => `You are extracting shot log values from Breville BES876 Barista Express Impress photos.
Return only valid JSON. Use only visible evidence from the photos. Do not guess missing values.

Dose mode selected by the user: ${doseMode}.
Photo metadata:
${photos.map((photo, index) => `- photo_${index + 1}: id=${photo.id}, type=${photo.photoType}, label=${photo.label ?? photo.photoType}`).join('\n')}

What to extract:
- grind_size_external: external grind dial number, 1-25, only if clearly visible.
- actual_dose_gram, yield_gram: only if a scale display is clearly visible.
- brew_seconds, first_drip_seconds, preinfusion_seconds: only if a timer/scale timer is clearly visible.
- dose_level: for AUTO mode, read the Impress dose gauge if visible: under, ideal, a_bit_more, over, or unknown.
- pressure_zone: read the pressure gauge peak position if visible: low, espresso_range, high, or unknown.
- used_a_bit_more: true only if A Bit More is visibly indicated or explicitly shown.
- used_razor_trim: true only if Razor trim use is visible or explicitly shown.
- shot_result: short Korean observation from espresso/cup photo, e.g. "좋음", "빠름", "느림", "묽음", "채널링 의심".
- channeling: none, suspected, visible, or null.

Mode rules:
- AUTO mode should prioritize dose gauge, A Bit More, Razor trim, grind dial, pressure gauge, and cup result.
- MANUAL mode should prioritize measured dose, grind dial, tamped puck, pressure gauge, flow/cup result, and channeling signs.
- If a value is not directly visible, return null and add it to uncertain_fields when relevant.
- Preserve useful visible text in visible_text_summary.`;

const schema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    bean_name: { type: ['string', 'null'] },
    roastery: { type: ['string', 'null'] },
    origin: { type: ['string', 'null'] },
    variety: { type: ['string', 'null'] },
    process: { type: ['string', 'null'] },
    roast_level: { type: ['string', 'null'] },
    purchase_date: { type: ['string', 'null'] },
    roast_date: { type: ['string', 'null'] },
    opened_date: { type: ['string', 'null'] },
    expiry_date: { type: ['string', 'null'] },
    weight: { type: ['string', 'null'] },
    initial_weight_gram: { type: ['number', 'null'] },
    seller: { type: ['string', 'null'] },
    price: { type: ['number', 'null'] },
    recommended_brew_method: { type: ['string', 'null'] },
    visible_text_summary: { type: ['string', 'null'] },
    uncertain_fields: { type: 'array', items: { type: 'string' } },
    warnings: { type: 'array', items: { type: 'string' } },
    conflicts: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          field: { type: 'string' },
          candidates: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              properties: {
                value: { type: 'string' },
                evidenceText: { type: ['string', 'null'] },
                sourcePhotoIds: { type: 'array', items: { type: 'string' } },
              },
              required: ['value', 'evidenceText', 'sourcePhotoIds'],
            },
          },
        },
        required: ['field', 'candidates'],
      },
    },
    unknown_dates: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          rawText: { type: 'string' },
          normalizedDate: { type: ['string', 'null'] },
          possibleMeanings: { type: 'array', items: { type: 'string' } },
          evidenceText: { type: ['string', 'null'] },
          sourcePhotoIds: { type: 'array', items: { type: 'string' } },
        },
        required: ['rawText', 'normalizedDate', 'possibleMeanings', 'evidenceText', 'sourcePhotoIds'],
      },
    },
  },
  required: [
    'bean_name',
    'roastery',
    'origin',
    'variety',
    'process',
    'roast_level',
    'purchase_date',
    'roast_date',
    'opened_date',
    'expiry_date',
    'weight',
    'initial_weight_gram',
    'seller',
    'price',
    'recommended_brew_method',
    'visible_text_summary',
    'uncertain_fields',
    'warnings',
    'conflicts',
    'unknown_dates',
  ],
};

const brewLogSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    grind_size_external: { type: ['number', 'null'] },
    actual_dose_gram: { type: ['number', 'null'] },
    yield_gram: { type: ['number', 'null'] },
    brew_seconds: { type: ['number', 'null'] },
    first_drip_seconds: { type: ['number', 'null'] },
    preinfusion_seconds: { type: ['number', 'null'] },
    dose_level: { type: ['string', 'null'], enum: ['under', 'ideal', 'a_bit_more', 'over', 'unknown', null] },
    pressure_zone: { type: ['string', 'null'], enum: ['low', 'espresso_range', 'high', 'unknown', null] },
    used_a_bit_more: { type: ['boolean', 'null'] },
    used_razor_trim: { type: ['boolean', 'null'] },
    shot_result: { type: ['string', 'null'] },
    channeling: { type: ['string', 'null'], enum: ['none', 'suspected', 'visible', null] },
    visible_text_summary: { type: ['string', 'null'] },
    uncertain_fields: { type: 'array', items: { type: 'string' } },
    warnings: { type: 'array', items: { type: 'string' } },
  },
  required: [
    'grind_size_external',
    'actual_dose_gram',
    'yield_gram',
    'brew_seconds',
    'first_drip_seconds',
    'preinfusion_seconds',
    'dose_level',
    'pressure_zone',
    'used_a_bit_more',
    'used_razor_trim',
    'shot_result',
    'channeling',
    'visible_text_summary',
    'uncertain_fields',
    'warnings',
  ],
};

const asDataUrl = async (uri: string) => {
  const base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
  const lower = uri.toLowerCase();
  const mime = lower.endsWith('.png') ? 'image/png' : lower.endsWith('.webp') ? 'image/webp' : 'image/jpeg';
  return `data:${mime};base64,${base64}`;
};

const preview = (value: string) => value.replace(/\s+/g, ' ').trim().slice(0, 180);

const stripFence = (value: string) => {
  const text = value.trim();
  const fenced = text.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenced?.[1]?.trim() ?? text;
};

const extractJsonText = (value: string) => {
  const stripped = stripFence(value);
  if (!stripped) throw new Error('AI 응답이 비어 있습니다.');
  try {
    JSON.parse(stripped);
    return stripped;
  } catch {
    const start = stripped.indexOf('{');
    const end = stripped.lastIndexOf('}');
    if (start >= 0 && end > start) {
      const candidate = stripped.slice(start, end + 1);
      try {
        JSON.parse(candidate);
        return candidate;
      } catch {
        // Fall through to a user-readable parsing error.
      }
    }
  }
  throw new Error(`AI JSON 파싱 실패: ${preview(stripped) || '응답 내용 없음'}`);
};

const parseJson = (value: string): AiAnalysisParsed => {
  const parsed = JSON.parse(extractJsonText(value));
  return {
    bean_name: parsed.bean_name ?? null,
    roastery: parsed.roastery ?? null,
    origin: parsed.origin ?? null,
    variety: parsed.variety ?? null,
    process: parsed.process ?? null,
    roast_level: parsed.roast_level ?? null,
    purchase_date: parsed.purchase_date ?? null,
    roast_date: parsed.roast_date ?? null,
    opened_date: parsed.opened_date ?? null,
    expiry_date: parsed.expiry_date ?? null,
    weight: parsed.weight ?? null,
    initial_weight_gram: typeof parsed.initial_weight_gram === 'number' ? parsed.initial_weight_gram : null,
    seller: parsed.seller ?? null,
    price: typeof parsed.price === 'number' ? parsed.price : null,
    recommended_brew_method: parsed.recommended_brew_method ?? null,
    visible_text_summary: parsed.visible_text_summary ?? null,
    uncertain_fields: Array.isArray(parsed.uncertain_fields) ? parsed.uncertain_fields : [],
    warnings: Array.isArray(parsed.warnings) ? parsed.warnings : [],
    conflicts: Array.isArray(parsed.conflicts) ? parsed.conflicts : [],
    unknown_dates: Array.isArray(parsed.unknown_dates) ? parsed.unknown_dates : [],
  };
};

const parseBrewLogJson = (value: string): BrewLogPhotoAnalysisParsed => {
  const parsed = JSON.parse(extractJsonText(value));
  const enumValue = <T extends string>(input: unknown, allowed: T[]) => typeof input === 'string' && allowed.includes(input as T) ? input as T : null;
  return {
    grind_size_external: typeof parsed.grind_size_external === 'number' ? parsed.grind_size_external : null,
    actual_dose_gram: typeof parsed.actual_dose_gram === 'number' ? parsed.actual_dose_gram : null,
    yield_gram: typeof parsed.yield_gram === 'number' ? parsed.yield_gram : null,
    brew_seconds: typeof parsed.brew_seconds === 'number' ? parsed.brew_seconds : null,
    first_drip_seconds: typeof parsed.first_drip_seconds === 'number' ? parsed.first_drip_seconds : null,
    preinfusion_seconds: typeof parsed.preinfusion_seconds === 'number' ? parsed.preinfusion_seconds : null,
    dose_level: enumValue(parsed.dose_level, ['under', 'ideal', 'a_bit_more', 'over', 'unknown']),
    pressure_zone: enumValue(parsed.pressure_zone, ['low', 'espresso_range', 'high', 'unknown']),
    used_a_bit_more: typeof parsed.used_a_bit_more === 'boolean' ? parsed.used_a_bit_more : null,
    used_razor_trim: typeof parsed.used_razor_trim === 'boolean' ? parsed.used_razor_trim : null,
    shot_result: typeof parsed.shot_result === 'string' ? parsed.shot_result : null,
    channeling: enumValue(parsed.channeling, ['none', 'suspected', 'visible']),
    visible_text_summary: typeof parsed.visible_text_summary === 'string' ? parsed.visible_text_summary : null,
    uncertain_fields: Array.isArray(parsed.uncertain_fields) ? parsed.uncertain_fields : [],
    warnings: Array.isArray(parsed.warnings) ? parsed.warnings : [],
  };
};

export const analyzeBeanImage = async (provider: AiProvider, modelName: string, photoUri: string, beanId?: string | null) => {
  return analyzeBeanPhotos(provider, modelName, [{ id: 'photo_1', uri: photoUri, photoType: 'front_label', label: 'Front label' }], beanId, 'new_product');
};

export const analyzeBeanPhotos = async (provider: AiProvider, modelName: string, photos: BeanAnalysisPhotoInput[], beanId?: string | null, mode: BeanAnalysisMode = 'new_product') => {
  if (provider === 'none') throw new Error('AI 제공자를 선택하세요.');
  const apiKey = await getApiKey(provider);
  if (!apiKey) throw new Error('API Key를 먼저 저장하세요.');
  if (photos.length === 0) throw new Error('분석할 사진을 먼저 추가하세요.');
  const selectedPhotos = photos.slice(0, 4);
  const dataUrls = await Promise.all(selectedPhotos.map(photo => asDataUrl(photo.uri)));
  const prompt = buildAnalysisPrompt(selectedPhotos, mode);

  let rawText = '';
  if (provider === 'openai') {
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: modelName || 'gpt-5-mini',
        input: [
          {
            role: 'user',
            content: [
              { type: 'input_text', text: prompt },
              ...dataUrls.map(dataUrl => ({ type: 'input_image', image_url: dataUrl, detail: 'high' })),
            ],
          },
        ],
        text: {
          format: {
            type: 'json_schema',
            name: 'coffee_bean_package',
            strict: true,
            schema,
          },
        },
      }),
    });
    const json = await response.json();
    if (!response.ok) throw new Error(json?.error?.message ?? 'OpenAI 분석에 실패했습니다.');
    rawText = json.output_text ?? json.output?.flatMap((item: any) => item.content ?? []).find((part: any) => part.text)?.text ?? '';
  } else {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelName || 'gemini-2.5-flash'}:generateContent`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: prompt },
              ...dataUrls.map(dataUrl => ({
                inline_data: {
                  mime_type: dataUrl.slice(5, dataUrl.indexOf(';')),
                  data: dataUrl.split(',')[1],
                },
              })),
            ],
          },
        ],
        generationConfig: {
          responseMimeType: 'application/json',
          responseJsonSchema: schema,
        },
      }),
    });
    const json = await response.json();
    if (!response.ok) throw new Error(json?.error?.message ?? 'Gemini 분석에 실패했습니다.');
    rawText = json.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  }

  const parsed = parseJson(rawText);
  await saveAiAnalysis({
    provider,
    modelName,
    beanId: beanId ?? null,
    photoUri: selectedPhotos[0].uri,
    rawJson: rawText,
    parsedJson: JSON.stringify(parsed),
    uncertainFields: JSON.stringify(parsed.uncertain_fields),
  });
  return parsed;
};

export const analyzeBrewLogPhotos = async (provider: AiProvider, modelName: string, photos: BeanAnalysisPhotoInput[], doseMode: 'auto' | 'manual', beanId?: string | null) => {
  if (provider === 'none') throw new Error('AI 제공자를 선택하세요.');
  const apiKey = await getApiKey(provider);
  if (!apiKey) throw new Error('API Key를 먼저 저장하세요.');
  if (photos.length === 0) throw new Error('분석할 사진을 먼저 추가하세요.');
  const selectedPhotos = photos.slice(0, 6);
  const dataUrls = await Promise.all(selectedPhotos.map(photo => asDataUrl(photo.uri)));
  const prompt = buildBrewLogAnalysisPrompt(selectedPhotos, doseMode);

  let rawText = '';
  if (provider === 'openai') {
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: modelName || 'gpt-5-mini',
        input: [
          {
            role: 'user',
            content: [
              { type: 'input_text', text: prompt },
              ...dataUrls.map(dataUrl => ({ type: 'input_image', image_url: dataUrl, detail: 'high' })),
            ],
          },
        ],
        text: {
          format: {
            type: 'json_schema',
            name: 'bes876_brew_log_photo_values',
            strict: true,
            schema: brewLogSchema,
          },
        },
      }),
    });
    const json = await response.json();
    if (!response.ok) throw new Error(json?.error?.message ?? 'OpenAI 분석에 실패했습니다.');
    rawText = json.output_text ?? json.output?.flatMap((item: any) => item.content ?? []).find((part: any) => part.text)?.text ?? '';
  } else {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelName || 'gemini-2.5-flash'}:generateContent`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: prompt },
              ...dataUrls.map(dataUrl => ({
                inline_data: {
                  mime_type: dataUrl.slice(5, dataUrl.indexOf(';')),
                  data: dataUrl.split(',')[1],
                },
              })),
            ],
          },
        ],
        generationConfig: {
          responseMimeType: 'application/json',
          responseJsonSchema: brewLogSchema,
        },
      }),
    });
    const json = await response.json();
    if (!response.ok) throw new Error(json?.error?.message ?? 'Gemini 분석에 실패했습니다.');
    rawText = json.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  }

  const parsed = parseBrewLogJson(rawText);
  await saveAiAnalysis({
    provider,
    modelName,
    beanId: beanId ?? null,
    photoUri: selectedPhotos[0].uri,
    rawJson: rawText,
    parsedJson: JSON.stringify(parsed),
    uncertainFields: JSON.stringify(parsed.uncertain_fields),
  });
  return parsed;
};

export const testAiKey = async (provider: AiProvider, modelName: string, apiKeyOverride?: string | null) => {
  const key = apiKeyOverride?.trim() || await getApiKey(provider);
  if (!key || provider === 'none') throw new Error('API Key와 제공자를 확인하세요.');
  if (provider === 'openai') {
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: modelName || 'gpt-5-mini', input: 'Reply with OK.' }),
    });
    if (!response.ok) throw new Error('OpenAI Key 테스트 실패');
    return true;
  }
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelName || 'gemini-2.5-flash'}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify({ contents: [{ parts: [{ text: 'Reply with OK.' }] }] }),
  });
  if (!response.ok) throw new Error('Gemini Key 테스트 실패');
  return true;
};
