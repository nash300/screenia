# Landing Hero Slides

Use this folder for the first-section slideshow on the landing page.

## Recommended Image Size

- Best size: `2560 x 1440 px`
- Minimum size: `1920 x 1080 px`
- Format: `.png`, `.jpg`, `.jpeg`, or `.webp`

Design each image as a full-screen background.

- Leave the left `40%` of the image mostly empty for the website text.
- Put the main visual detail in the right `60%` of the image.
- Keep important objects away from the outer `8%` edges so mobile cropping still looks good.
- Use light blue colors if you want the current hero theme to stay consistent.

For a `2560 x 1440 px` image:

- Left text-safe area: `0-1024 px`
- Right visual area: `1024-2560 px`

For a `1920 x 1080 px` image:

- Left text-safe area: `0-768 px`
- Right visual area: `768-1920 px`

## Add A New Slide

1. Create a new numbered folder, for example `03`.
2. Put the background image inside it, for example `03/image.png`.
3. Open `slides.json`.
4. Add a new object to the `slides` list:

```json
{
  "id": "03",
  "image": "03/image.png",
  "sv": {
    "eyebrow": "Kort rubrik",
    "title": "Stor rubrik här.",
    "text": "Beskrivande text som hör till bilden."
  },
  "en": {
    "eyebrow": "Short label",
    "title": "Main headline here.",
    "text": "Supporting text for the image."
  }
}
```

The site shows slides in the same order as `slides.json`.
