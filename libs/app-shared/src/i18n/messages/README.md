# Translation Files Guide

## Structure

Each language file follows the same structure:

```json
{
  "common": { ... },
  "auth": { ... },
  "navigation": { ... },
  "organizations": { ... },
  "users": { ... },
  "workflows": { ... },
  "aiModules": { ... },
  "notifications": { ... },
  "errors": { ... }
}
```

## Adding New Translations

### Step 1: Add to English (en.json)

Always add new translations to English first:

```json
{
  "myFeature": {
    "title": "My Feature",
    "description": "Feature description",
    "button": "Click Me"
  }
}
```

### Step 2: Add to Other Languages

Add the same structure to all other language files with translations:

**zh.json:**
```json
{
  "myFeature": {
    "title": "我的功能",
    "description": "功能描述",
    "button": "点击我"
  }
}
```

**ja.json:**
```json
{
  "myFeature": {
    "title": "私の機能",
    "description": "機能の説明",
    "button": "クリック"
  }
}
```

### Step 3: Use in Components

```tsx
const t = useTranslation()
<h1>{t('myFeature.title')}</h1>
<p>{t('myFeature.description')}</p>
<button>{t('myFeature.button')}</button>
```

## Translation Keys Convention

- Use camelCase for keys: `myFeature`, `userProfile`
- Group related translations: Keep related translations together
- Use descriptive names: `saveButton` instead of `saveBtn`
- Keep consistent structure across languages

## Parameters

Use `{{paramName}}` for dynamic values:

```json
{
  "welcome": "Welcome, {{name}}!",
  "itemsCount": "You have {{count}} items"
}
```

```tsx
t('welcome', { name: 'John' })
t('itemsCount', { count: 5 })
```

## Best Practices

1. **Always add to English first** - English is the source of truth
2. **Keep structure consistent** - Same keys in all languages
3. **Use descriptive keys** - `auth.loginButton` not `btn1`
4. **Group logically** - Related translations together
5. **Test all languages** - Ensure translations work correctly

## Missing Translations

If a translation is missing:
- System falls back to the key name
- Console warning is logged
- Add missing translation to all language files

## Translation Quality

- Use professional translators for production
- Review translations for accuracy
- Consider cultural context
- Test with native speakers
