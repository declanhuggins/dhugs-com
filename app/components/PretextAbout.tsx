'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import {
  prepareWithSegments,
  layoutNextLine,
  type LayoutCursor,
  type PreparedTextWithSegments,
} from '@chenglou/pretext';

// --- Fonts & layout constants ---
const HEADING_FONT = '700 28px "Courier New", Courier, monospace';
const BODY_FONT = '400 16px "Courier New", Courier, monospace';
const ITALIC_FONT = 'italic 400 16px "Courier New", Courier, monospace';
const HEADING_LH = 38;
const BODY_LH = 24;
const PARA_GAP = 18; // extra vertical space between paragraphs
const IMG_GAP = 20; // margin around floated images

interface TextBlock {
  text: string;
  font: string;
  lineHeight: number;
}

const BLOCKS: TextBlock[] = [
  { text: 'About', font: HEADING_FONT, lineHeight: HEADING_LH },
  {
    text: "From my earliest memories tinkering with computers, I've been a relentless tech enthusiast. Growing up with a software engineer for a dad and a pro bono lawyer for a mom instilled dual passions in me\u2014the power of tech, and using it to make an impact. This spirit drives me as I prepare to join the University of Notre Dame's Class of 2028, where I'll shape my computer science future while simultaneously charting a course toward a career as an officer in the United States Air Force.",
    font: BODY_FONT, lineHeight: BODY_LH,
  },
  {
    text: "My coding journey began young, but I'm never satisfied with just the basics. I'm a tinkerer and a troubleshooter, always digging deeper into languages like Python and Java, server management, cloud platforms, and the ever-evolving landscape of cybersecurity. Beyond my formal studies, I find a creative outlet in AI exploration, experimenting with image and voice synthesis tools to craft unique digital experiences.",
    font: BODY_FONT, lineHeight: BODY_LH,
  },
  {
    text: "Alongside my technical pursuits lies my passion for photography and the art of audio engineering. Capturing the world through my lens and crafting sonic landscapes in the theater gives me alternative ways to express myself and engage with others. These multifaceted interests make me both a well-rounded tech professional and a dynamic creative mind.",
    font: BODY_FONT, lineHeight: BODY_LH,
  },
  {
    text: "My experience at Fenwick High School ingrained core values\u2014initiative, intellectual rigor, and service to others. These fuel my extracurricular leadership, and I'm already envisioning ways to combine my cybersecurity knowledge and military aspirations for a greater purpose as I become part of the Notre Dame community. I can't wait to join the university's collaborative and demanding CS program, where I'll push my limits and contribute to cutting-edge projects that make a meaningful difference.",
    font: BODY_FONT, lineHeight: BODY_LH,
  },
  {
    text: "I believe technology, in the right hands, can solve critical problems. Whether that's protecting vital infrastructure with robust cybersecurity systems or developing tools for greater accessibility and inclusivity, I'm driven by the potential to leave the world better than I found it. My journey is just beginning, but I'm eager to leverage my skills and passions to drive positive change.",
    font: BODY_FONT, lineHeight: BODY_LH,
  },
  {
    text: "I'm always eager to talk tech, photography, or anything in between. Feel free to explore my website to see my photography and delve into some of my latest computer science projects. Whether you're seeking a collaborator for a new project, have a question about my work, or just want to connect with a fellow tech enthusiast, don't hesitate to reach out. You might even find inspiration for something of your own!",
    font: BODY_FONT, lineHeight: BODY_LH,
  },
  { text: '~/ Declan Huggins', font: ITALIC_FONT, lineHeight: BODY_LH },
];

// --- Image float rectangles ---
// Each image "floats" at a position; text lines narrow to avoid it.
interface FloatRect {
  side: 'left' | 'right';
  x: number;
  y: number;
  w: number;
  h: number;
}

function computeFloats(containerW: number, img1Aspect: number, img2Aspect: number): FloatRect[] {
  // Image 1: left float, starts below the "About" heading
  const headingSpace = HEADING_LH + PARA_GAP;
  const img1W = Math.min(Math.round(containerW * 0.35), 360);
  const img1H = Math.round(img1W / img1Aspect);

  // Image 2: right float, starts after image 1 ends + a few lines of full-width text
  const img2W = Math.min(Math.round(containerW * 0.32), 320);
  const img2H = Math.round(img2W / img2Aspect);
  const img2Y = headingSpace + img1H + BODY_LH * 3;

  return [
    { side: 'left', x: 0, y: headingSpace, w: img1W, h: img1H },
    { side: 'right', x: containerW - img2W, y: img2Y, w: img2W, h: img2H },
  ];
}

/** Given a Y position and line height, compute available text X and width around floats. */
function lineGeometry(
  y: number,
  lh: number,
  floats: FloatRect[],
  containerW: number,
): { x: number; w: number } {
  let x = 0;
  let w = containerW;

  for (const f of floats) {
    const lineTop = y;
    const lineBot = y + lh;
    // Does this line overlap the float vertically?
    if (lineBot > f.y && lineTop < f.y + f.h) {
      if (f.side === 'left') {
        const indent = f.w + IMG_GAP;
        x = Math.max(x, indent);
        w = containerW - x;
      } else {
        const rightEdge = f.x - IMG_GAP;
        w = Math.min(w, rightEdge - x);
      }
    }
  }
  return { x, w: Math.max(w, 60) }; // minimum 60px to avoid degenerate wrapping
}

interface Props {
  img1Src: string;
  img2Src: string;
  img1Alt: string;
  img2Alt: string;
}

export default function PretextAbout({ img1Src, img2Src, img1Alt, img2Alt }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [totalHeight, setTotalHeight] = useState(1200);
  const [floats, setFloats] = useState<FloatRect[]>([]);

  // Approximate aspect ratios (will be refined after images load)
  const img1Aspect = useRef(1.0); // w/h
  const img2Aspect = useRef(0.75);

  const render = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const pr = window.devicePixelRatio || 1;
    const W = container.clientWidth;
    if (W <= 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const style = getComputedStyle(document.documentElement);
    const textColor = style.getPropertyValue('--foreground').trim() || '#e0e0e0';

    const fls = computeFloats(W, img1Aspect.current, img2Aspect.current);
    setFloats(fls);

    // --- Stream text layout around floats ---
    type DrawnLine = { text: string; font: string; x: number; y: number; lh: number };
    const drawn: DrawnLine[] = [];
    let y = 0;

    for (const block of BLOCKS) {
      const prepared: PreparedTextWithSegments = prepareWithSegments(block.text, block.font);
      let cursor: LayoutCursor = { segmentIndex: 0, graphemeIndex: 0 };

      for (;;) {
        const { x: lx, w: lw } = lineGeometry(y, block.lineHeight, fls, W);
        const line = layoutNextLine(prepared, cursor, lw);
        if (!line) break;

        drawn.push({ text: line.text, font: block.font, x: lx, y, lh: block.lineHeight });
        cursor = line.end;
        y += block.lineHeight;
      }
      y += PARA_GAP;
    }

    const h = y;
    setTotalHeight(h);

    // Size canvas
    canvas.width = W * pr;
    canvas.height = h * pr;
    canvas.style.width = `${W}px`;
    canvas.style.height = `${h}px`;
    ctx.scale(pr, pr);
    ctx.clearRect(0, 0, W, h);

    // Draw text
    for (const dl of drawn) {
      ctx.font = dl.font;
      ctx.fillStyle = textColor;
      ctx.fillText(dl.text, dl.x, dl.y + dl.lh * 0.78);
    }
  }, []);

  // Handle image load to get actual aspect ratios, then re-render
  const onImg1Load = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    if (img.naturalWidth && img.naturalHeight) {
      img1Aspect.current = img.naturalWidth / img.naturalHeight;
      render();
    }
  }, [render]);

  const onImg2Load = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    if (img.naturalWidth && img.naturalHeight) {
      img2Aspect.current = img.naturalWidth / img.naturalHeight;
      render();
    }
  }, [render]);

  useEffect(() => {
    render();
    const ro = new ResizeObserver(() => render());
    if (containerRef.current) ro.observe(containerRef.current);
    const mo = new MutationObserver(() => render());
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => { ro.disconnect(); mo.disconnect(); };
  }, [render]);

  const plainText = BLOCKS.map(b => b.text).join('\n\n');

  return (
    <div ref={containerRef} className="relative w-full" style={{ minHeight: totalHeight }}>
      {/* Floated images — positioned absolutely, text wraps around them on the canvas */}
      {floats[0] && (
        /* eslint-disable-next-line @next/next/no-img-element -- absolute canvas positioning needs native img */
        <img
          src={img1Src}
          alt={img1Alt}
          onLoad={onImg1Load}
          className="absolute rounded object-cover"
          style={{
            left: floats[0].x,
            top: floats[0].y,
            width: floats[0].w,
            height: floats[0].h,
          }}
        />
      )}
      {floats[1] && (
        /* eslint-disable-next-line @next/next/no-img-element -- absolute canvas positioning needs native img */
        <img
          src={img2Src}
          alt={img2Alt}
          onLoad={onImg2Load}
          className="absolute rounded object-cover"
          style={{
            left: floats[1].x,
            top: floats[1].y,
            width: floats[1].w,
            height: floats[1].h,
          }}
        />
      )}
      {/* Text canvas */}
      <canvas
        ref={canvasRef}
        className="relative w-full"
        style={{ height: totalHeight }}
        role="img"
        aria-label={plainText}
      />
      <div className="sr-only">{plainText}</div>
    </div>
  );
}
