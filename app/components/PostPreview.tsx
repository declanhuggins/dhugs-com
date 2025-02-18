// app/components/PostPreview.tsx
import Image from 'next/image';

interface PostPreviewProps {
  title: string;
  date: string;
  imageSrc: string;
  altText?: string;
}

export default function PostPreview({ title, date, imageSrc, altText }: PostPreviewProps) {
  return (
    <article className="mb-8">
      <div className="mb-2 text-gray-400 text-sm">{date}</div>
      <h2 className="text-xl font-bold mb-2">{title}</h2>
      <div className="relative w-full h-64 bg-gray-800">
        <Image
          src={imageSrc}
          alt={altText || title}
          fill
          className="object-cover"
        />
      </div>
    </article>
  );
}