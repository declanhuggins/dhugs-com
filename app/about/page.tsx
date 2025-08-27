import '../../scripts/env-init';
import Image from 'next/image';

export default function AboutPage() {
  return (
    <div>
      <h1 className="text-3xl font-bold mb-8 text-center">About</h1>
      <article className="space-y-6">
        <div className="w-full mx-auto md:w-[40%] md:float-left md:mr-4 md:mb-4">
          <Image
            src={`${process.env.CDN_SITE}/large/about/AboutOne.avif`}
            alt="About photo one"
            width={500}
            height={500}
            className="object-cover rounded w-full"
          />
        </div>
        <p>
          From my earliest memories tinkering with computers, I’ve been a relentless tech enthusiast. Growing up with a software engineer for a dad and a pro bono lawyer for a mom instilled dual passions in me—the power of tech, and using it to make an impact. This spirit drives me as I prepare to join the University of Notre Dame’s Class of 2028, where I’ll shape my computer science future while simultaneously charting a course toward a career as an officer in the United States Air Force.
        </p>
        <p>
          My coding journey began young, but I’m never satisfied with just the basics. I’m a tinkerer and a troubleshooter, always digging deeper into languages like Python and Java, server management, cloud platforms, and the ever-evolving landscape of cybersecurity. Beyond my formal studies, I find a creative outlet in AI exploration, experimenting with image and voice synthesis tools to craft unique digital experiences.
        </p>
        <div className="w-full mx-auto md:w-[30%] md:float-right md:ml-4 md:mb-4">
          <Image
            src={`${process.env.CDN_SITE}/large/about/AboutTwo.avif`}
            alt="About photo two"
            width={500}
            height={500}
            className="object-cover rounded w-full"
          />
        </div>
        <p>
          Alongside my technical pursuits lies my passion for photography and the art of audio engineering. Capturing the world through my lens and crafting sonic landscapes in the theater gives me alternative ways to express myself and engage with others. These multifaceted interests make me both a well-rounded tech professional and a dynamic creative mind.
        </p>
        <p>
          My experience at Fenwick High School ingrained core values – initiative, intellectual rigor, and service to others. These fuel my extracurricular leadership, and I’m already envisioning ways to combine my cybersecurity knowledge and military aspirations for a greater purpose as I become part of the Notre Dame community. I can’t wait to join the university’s collaborative and demanding CS program, where I’ll push my limits and contribute to cutting-edge projects that make a meaningful difference.
        </p>
        <p>
          I believe technology, in the right hands, can solve critical problems. Whether that’s protecting vital infrastructure with robust cybersecurity systems or developing tools for greater accessibility and inclusivity, I’m driven by the potential to leave the world better than I found it. My journey is just beginning, but I’m eager to leverage my skills and passions to drive positive change.
        </p>
        <p>
          I’m always eager to talk tech, photography, or anything in between. Feel free to explore my website to see my photography and delve into some of my latest computer science projects. Whether you’re seeking a collaborator for a new project, have a question about my work, or just want to connect with a fellow tech enthusiast, don’t hesitate to reach out. You might even find inspiration for something of your own!
        </p>
        <div className="clear-both"></div>
        <p className="mt-4 italic text-left">~/ Declan Huggins</p>
      </article>
    </div>
  );
}
