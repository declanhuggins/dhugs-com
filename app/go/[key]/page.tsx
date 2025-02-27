import { redirect, notFound } from 'next/navigation'
import { JSX } from 'react';
import fs from 'fs'
import path from 'path'
import matter from 'gray-matter'

export const runtime = 'edge'

interface PageProps {
  params: Promise<{ 
    key: string
  }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function KeyRedirect({ params }: PageProps): Promise<JSX.Element> {
  const { key } = await params
  const filePath = path.join(process.cwd(), 'links/links.md')
  const fileContent = fs.readFileSync(filePath, 'utf8')
  const { data } = matter(fileContent)
  
  const targetURL = data[key]
  if (targetURL) {
    redirect(targetURL)
  } else {
    notFound()
  }
}
