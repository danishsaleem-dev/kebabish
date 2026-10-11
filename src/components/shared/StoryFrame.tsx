import Image from "next/image";
import StoryVideo from "@/components/home/StoryVideo";
import { STORY_POSTER, STORY_VIDEO_SRC, storyVideoAvailable } from "@/lib/story-media";

/**
 * The portrait media frame used by both story sections — the homepage's and
 * the about page's. It was the same markup copied into both, which is how the
 * about page kept showing a still after the homepage moved to video; one
 * component means that can't drift again.
 *
 * The clip is `about-video.mp4` (see `lib/story-media.ts`), a portrait clip that
 * fits this frame without cropping. Checked at build time like the hero's own.
 *
 * The poster still is the server-rendered layer — a crawler, a no-JS reader,
 * anyone on save-data or asking for reduced motion sees this — and StoryVideo
 * fades the clip in over it once the section is near. The poster is a frame of
 * that same clip, so there is no visible swap.
 */
export default function StoryFrame({
  videoLabel,
  detailAlt,
  posterAlt,
}: {
  videoLabel: string;
  /** Alt text for the small overlapping detail shot. */
  detailAlt: string;
  posterAlt: string;
}) {
  const hasVideo = storyVideoAvailable();

  return (
    <div className="relative order-2 lg:order-1">
      <div
        data-reveal="scale"
        className="relative aspect-4/5 overflow-hidden rounded-[1.75rem] bg-charcoal-800 sm:aspect-3/4"
      >
        <Image
          src={hasVideo ? STORY_POSTER : "/images/story/tandoor.jpg"}
          alt={posterAlt}
          fill
          sizes="(min-width: 1024px) 45vw, 90vw"
          data-parallax="0.06"
          className="scale-110 object-cover"
        />
        {hasVideo && (
          <StoryVideo src={STORY_VIDEO_SRC} poster={STORY_POSTER} label={videoLabel} />
        )}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-charcoal-950/45 to-transparent" />
      </div>

      {/* Overlapping detail shot, hidden on the narrowest screens where it
          would crowd the main frame. */}
      <div
        data-reveal="scale"
        data-reveal-delay="0.12"
        className="absolute -bottom-8 -right-4 hidden aspect-square w-40 overflow-hidden rounded-2xl border-[6px] border-cream-200 bg-charcoal-800 shadow-xl shadow-charcoal-950/10 sm:block sm:w-48 lg:-right-8"
      >
        <Image
          src="/images/story/spices.jpg"
          alt={detailAlt}
          fill
          sizes="200px"
          className="object-cover"
        />
      </div>
    </div>
  );
}
