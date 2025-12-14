const asyncHandler = require('../middleware/async');
const wikidataService = require('../services/wikidata/WikidataService');

exports.translateTitle = asyncHandler(async (req, res) => {
  const { title, author, direction = 'en_to_ru' } = req.query;

  if (!title?.trim()) {
    return res.status(400).json({
      success: false,
      code: 'WIKIDATA_TITLE_REQUIRED',
      message: 'Query parameter "title" is required.',
    });
  }

  const normalizedDirection = direction === 'ru_to_en' ? 'ru_to_en' : 'en_to_ru';

  try {
    const translated =
      normalizedDirection === 'ru_to_en'
        ? await wikidataService.getEnglishTitle({ title, author })
        : await wikidataService.getRussianTitle({ title, author });

    if (!translated) {
      return res.status(404).json({
        success: false,
        code: 'WIKIDATA_TRANSLATION_NOT_FOUND',
        message: 'Не удалось найти перевод названия на Wikidata.',
      });
    }

    return res.json({
      success: true,
      data: {
        title: translated,
        direction: normalizedDirection,
      },
    });
  } catch (error) {
    console.error('Wikidata translation error:', error);
    return res.status(502).json({
      success: false,
      code: 'WIKIDATA_TRANSLATION_FAILED',
      message: 'Не удалось обратиться к Wikidata. Попробуйте позже.',
    });
  }
});

