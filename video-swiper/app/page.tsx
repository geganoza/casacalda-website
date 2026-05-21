import { VideoRibbon } from "@/components/VideoRibbon";
import { slides } from "@/lib/slides";

export default function Home() {
  return (
    <main className="page">
      <VideoRibbon slides={slides} />
    </main>
  );
}
