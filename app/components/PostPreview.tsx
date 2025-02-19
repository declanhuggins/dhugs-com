// app/components/PostPreview.tsx
import Link from 'next/link';
import Image from 'next/image';

interface PostPreviewProps {
  title: string;
  date: string;
  imageSrc: string;
  slug: string;
  altText?: string;
}

export default function PostPreview({ title, date, imageSrc, slug, altText }: PostPreviewProps) {
  // Extract year and month from the date string
  const postDate = new Date(date);
  const year = postDate.getFullYear().toString();
  const month = ("0" + (postDate.getMonth() + 1)).slice(-2);

  return (
    <article className="mb-8">
      <div className="mb-2 text-[var(--text-light-muted)] text-sm">{date}</div>
      <h2 className="text-xl font-bold mb-2">
        <Link href={`/${year}/${month}/${slug}`}>
          {title}
        </Link>
      </h2>
      <div className="relative w-full">
        <Image
          src={imageSrc}
          alt={altText || title}
          width={700}    // Adjust as needed
          height={475}   // Adjust as needed
          className="object-cover border-box"
        />
      </div>
    </article>
  );
}