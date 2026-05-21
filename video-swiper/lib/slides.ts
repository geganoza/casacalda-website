export type Slide = {
  id: string;
  title: string;
  subtitle: string;
  videoUrl: string;
};

// Placeholder videos — replace with your own clips in `public/videos/`
export const slides: Slide[] = [
  {
    id: "riverwalk",
    subtitle: "Project",
    title: "A more resilient Providence Riverwalk",
    videoUrl: "/videos/riverwalk.mp4",
  },
  {
    id: "resilient",
    subtitle: "Insight",
    title: "Resilient futures for a changing climate",
    videoUrl: "/videos/resilient.mp4",
  },
  {
    id: "milano",
    subtitle: "Project",
    title: "Milano Arena, a venue for the future",
    videoUrl: "/videos/milano.mp4",
  },
  {
    id: "melbourne",
    subtitle: "Project",
    title: "Melbourne Metro, moving a city",
    videoUrl: "/videos/melbourne.mp4",
  },
  {
    id: "sustainable",
    subtitle: "Story",
    title: "Engineering a more sustainable world",
    videoUrl: "/videos/sustainable.mp4",
  },
];
