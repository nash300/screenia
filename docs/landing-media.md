# Landing media guide

Use this guide when adding hero presentation videos, matching hero text, and service logos.

## Hero slide structure

Hero slides live here:

```text
public/landing/hero-slides/
```

Each slide is one numbered folder:

```text
public/landing/hero-slides/01/
public/landing/hero-slides/02/
public/landing/hero-slides/03/
```

Each numbered folder must contain:

```text
video.mp4
slide.json
```

The website reads the numbered folders in alphabetical order. `01` shows first, then `02`, then `03`. Each slide stays visible for 4 seconds.

The older folder below is not used by the landing page anymore:

```text
public/landing/hero-videos/
```

## Add a New Hero Slide

Step 1: Create the next numbered folder.

If the last slide is `01`, create:

```text
public/landing/hero-slides/02/
```

Step 2: Add your exported presentation video into that folder.

The video file must be named:

```text
video.mp4
```

The full path should look like this:

```text
public/landing/hero-slides/02/video.mp4
```

Step 3: Add the text file into the same folder.

The text file must be named:

```text
slide.json
```

The full path should look like this:

```text
public/landing/hero-slides/02/slide.json
```

Step 4: Use this format inside `slide.json`:

```json
{
  "sv": {
    "eyebrow": "Digital skyltning för företag",
    "title": "Svensk rubrik här",
    "text": "Svensk beskrivning här."
  },
  "en": {
    "eyebrow": "Digital signage for businesses",
    "title": "English heading here",
    "text": "English description here."
  }
}
```

Step 5: Keep the video and text about the same topic.

Example:

```text
public/landing/hero-slides/02/video.mp4
```

matches:

```text
public/landing/hero-slides/02/slide.json
```

Step 6: Refresh the website.

The site will automatically include the new numbered slide.

## Copy Template

There is a template text file here:

```text
public/landing/hero-slides/_template/slide.json
```

You can copy that file into a new numbered slide folder and then edit the text.

Do not put `video.mp4` inside `_template`. The website ignores template folders without a video.

## Recommended Video Export

Use this for every hero slide video:

```text
Duration: 4 seconds
Format: MP4
Resolution: 1920 x 1080
Filename: video.mp4
```

Use a 16:9 design. On desktop, the video appears mostly on the right side of the hero. On mobile, the video can sit behind the text, so keep the important visual content near the center.

## Service Logos

Service logos live here:

```text
public/landing/service-logos/
```

Only `.png` files are shown.

Use transparent PNG files when possible:

```text
01-klarna.png
02-dhl.png
03-postnord.png
```

The logo panel appears at the bottom of the hero text section. Its height is about one eleventh of the screen height.
