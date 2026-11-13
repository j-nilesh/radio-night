"use client";

/**
 * EvidencePhoto.tsx
 * A picture of a find. For a note, the writing is set here in code over the
 * blank paper in the picture, because image models draw text badly and the
 * words must match the examine text exactly.
 *
 * The writing is hidden from screen readers: the same words are already in
 * the examine narration and the casebook summary next to the picture.
 */

import type { ImageRef } from "@ai-orchestration/case-content";
import { Photo } from "./Photo";

export type EvidencePhotoProps = {
  image: ImageRef;
  /** Writing to set over the picture; shown only when `showText` is true */
  imageText?: string;
  /** Too small to read (a thumbnail): show the picture alone */
  showText?: boolean;
  /** A title or caption beside the picture already names it */
  decorative?: boolean;
  className?: string;
};

export function EvidencePhoto({ image, imageText, showText = true, decorative, className = "" }: EvidencePhotoProps) {
  return (
    <Photo image={image} decorative={decorative} className={`photo--evidence ${className}`}>
      {imageText && showText && (
        <span className="note-slip" aria-hidden="true">
          {imageText}
        </span>
      )}
    </Photo>
  );
}
