import { Link } from "wouter";
import { ArrowRight } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";
import * as ColorThief from "colorthief";

interface CategoryCardProps {
  id: number;
  title: string;
  description: string;
  image: string;
  link?: string;
}

export default function CategoryCard({
  id,
  title,
  description,
  image,
  link = `/categoria/${id}`,
}: CategoryCardProps) {
  const { data: settings } = trpc.shop.getSettings.useQuery();
  const [glowColor, setGlowColor] = useState("rgb(0, 200, 200)"); // Default cyan
  const imgRef = useRef<HTMLImageElement>(null);

  // Parse hex color to RGB
  const hexToRgb = (hex: string) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (result) {
      return `rgb(${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)})`;
    }
    return "rgb(0, 200, 200)";
  };

  // Get fallback glow color from settings
  const fallbackGlowColor = settings?.glowColor ? hexToRgb(settings.glowColor) : "rgb(0, 200, 200)";

  useEffect(() => {
    if (!imgRef.current) return;

    const img = imgRef.current;

    const extractColor = async () => {
      try {
        const color = await ColorThief.getColor(img);
        if (color && Array.isArray(color) && color.length >= 3) {
          const r = (color[0] as unknown as number) || 0;
          const g = (color[1] as unknown as number) || 0;
          const b = (color[2] as unknown as number) || 0;
          setGlowColor(`rgb(${r}, ${g}, ${b})`);
        }
      } catch (err) {
        // Fallback to configured glow color if color extraction fails
        setGlowColor(fallbackGlowColor);
      }
    };

    if (img.complete) {
      extractColor();
    } else {
      img.addEventListener("load", () => extractColor());
    }
  }, [image, fallbackGlowColor]);

  // Get intensity from settings (default 0.4)
  const glowIntensity = parseFloat(settings?.glowIntensity ?? "0.4");
  const glowIntensityHover = Math.min(glowIntensity + 0.2, 1);

  return (
    <Link href={link}>
      <div className="group cursor-pointer h-full">
        {/* Card Container - Horizontal Layout */}
        <div className="relative rounded-3xl border border-foreground/10 bg-card/40 backdrop-blur-sm overflow-hidden transition-all duration-300 hover:scale-[1.02] hover:ring-2 hover:ring-primary hover:shadow-2xl hover:shadow-primary/20 flex items-stretch">
          {/* Background Glow Effect */}
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

          {/* Image Container - Left Side */}
          <div className="relative shrink-0 flex items-center justify-center p-4">
            {/* Image with border glow */}
            <div
              className="relative w-32 h-32 rounded-2xl overflow-hidden group-hover:scale-110 transition-transform duration-300"
              style={{
                boxShadow: `0 0 30px 10px ${glowColor}, 0 0 60px 20px ${glowColor}80`,
                opacity: 1,
              }}
            >
              <img
                ref={imgRef}
                src={image}
                alt={title}
                className="w-full h-full object-cover"
                crossOrigin="anonymous"
              />
            </div>
          </div>

          {/* Text Content - Right Side */}
          <div className="relative z-10 flex-1 flex flex-col justify-center p-6">
            <h3 className="text-lg font-semibold text-foreground mb-2 group-hover:text-primary transition-colors duration-300">
              {title}
            </h3>
            <p className="text-sm text-muted-foreground group-hover:text-foreground/70 transition-colors duration-300 line-clamp-2 mb-4">
              {description}
            </p>

            {/* Button */}
            <button className="mt-auto w-fit px-6 py-2 rounded-full bg-primary/20 hover:bg-primary/30 text-primary hover:text-primary/80 transition-all duration-300 flex items-center gap-2 font-medium text-sm group/btn">
              Ver produtos
              <ArrowRight className="size-4 group-hover/btn:translate-x-1 transition-transform duration-300" />
            </button>
          </div>

          {/* Overlay on hover */}
          <div className="absolute inset-0 bg-gradient-to-r from-black/20 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
        </div>
      </div>
    </Link>
  );
}
