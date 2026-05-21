# Video Ribbon Slider

Horizontal video carousel inspired by [arup.com](https://www.arup.com). One large active card plays a video; smaller neighbors peek on the left and right. When the active video ends, the next one takes over automatically.

## Run

```bash
npm install
npm run dev
```

Open http://localhost:3000

## Key files

| File | What it does |
|------|--------------|
| `components/VideoRibbon.tsx` | The slider component (Swiper + auto-advance logic) |
| `app/globals.css` | Layout, slide widths, animation timings |
| `lib/slides.ts` | Slide data (title, subtitle, video URL) |
| `public/videos/` | Placeholder videos — replace with your own |

## How it works

- **[Swiper.js](https://swiperjs.com)** handles the horizontal carousel, with `slidesPerView="auto"` + `centeredSlides`
- **CSS** controls slide widths: active slide is wide (`--slide-active-w`), neighbors are narrow (`--slide-idle-w`)
- **React refs** keep track of each `<video>` element
- On slide change, the active video plays from 0 and neighbors pause
- On `video.onended`, we call `swiper.slideTo(next)` to auto-advance

## Customization

**Change videos** — edit `lib/slides.ts`, put your files in `public/videos/`.

**Change sizes** — edit the CSS variables at the top of `app/globals.css`:

```css
:root {
  --slide-active-w: min(70vw, 1016px);
  --slide-idle-w: min(25vw, 366px);
  --slide-active-h: clamp(320px, 36vw, 572px);
  --slide-idle-h: clamp(220px, 20vw, 326px);
  --slide-duration: 700ms;
}
```

**Change animation** — `--slide-duration` (CSS) + `speed={700}` on the Swiper (TSX).
