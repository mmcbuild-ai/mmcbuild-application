import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Target, Lightbulb, Users, Leaf } from "lucide-react";

export const metadata: Metadata = {
  title: "About MMC Build — AI-Powered Modern Methods of Construction",
  description:
    "MMC Build is revolutionising Australian construction through AI-powered modern methods. Meet the team and mission behind the platform.",
};

const values = [
  {
    icon: Target,
    title: "Innovation First",
    description:
      "We push boundaries in construction technology, constantly exploring new methods and materials.",
  },
  {
    icon: Lightbulb,
    title: "Simplicity",
    description:
      "Complex problems deserve elegant solutions. We make advanced technology accessible to everyone.",
  },
  {
    icon: Users,
    title: "Collaboration",
    description:
      "We believe in the power of community, connecting professionals to build better together.",
  },
  {
    icon: Leaf,
    title: "Sustainability",
    description:
      "Every decision we make considers environmental impact. The future of building must be green.",
  },
];

const team = [
  {
    name: "Karen Van Den Engel",
    role: "Founder & CEO",
    image:
      "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/695a6292259ab924ff961e1d/347dcf422_KarenHeadshot.png",
    bio: "20+ years across project management, property development, and construction delivery. Karen leads MMC Build's strategy, partnerships, and industry alignment.",
  },
  {
    name: "Michael Van Den Engel",
    role: "Co-Founder",
    image:
      "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/695a6292259ab924ff961e1d/88a2a3688_MichaelHeadshot.png",
    bio: "30+ years in building and site management. Michael brings deep construction knowledge and national industry networks.",
  },
  {
    name: "Karthik Rao",
    role: "Co-Founder & CTO",
    image:
      "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/695a6292259ab924ff961e1d/8c3d9d16b_KarthikHeadshot.jpg",
    bio: "20+ years of experience building enterprise technology and AI-driven products across telecommunications, infrastructure, and financial services. Karthik leads MMC Build's technology strategy and AI-enabled innovative solutions.",
  },
];

export default function AboutPage() {
  return (
    <>
      <section className="relative bg-[#0f172a] text-white overflow-hidden py-16">
        <div className="absolute top-0 left-1/2 w-[800px] h-[400px] -translate-x-1/2 bg-blue-600/20 blur-[100px] rounded-full pointer-events-none" />
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center z-10">
          <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl lg:text-6xl mb-6">
            About MMC Build
          </h1>
          <p className="mx-auto max-w-2xl text-xl text-slate-300">
            We&apos;re on a mission to revolutionise the construction industry through AI-powered modern methods.
          </p>
        </div>
      </section>

      <section className="py-24 bg-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <h2 className="text-3xl font-bold text-slate-900 mb-6">Our Mission</h2>
              <p className="text-lg text-slate-600 mb-6">
                At MMC Build, we believe the future of construction lies in the intelligent integration of modern methods and artificial intelligence. Our platform empowers architects, builders, and developers to create structures that are faster to build, more cost-effective, and environmentally sustainable.
              </p>
              <p className="text-lg text-slate-600 mb-8">
                Founded in 2023 in Sydney, Australia, we&apos;re bringing together the best minds in construction technology and AI to solve the industry&apos;s most pressing challenges.
              </p>
              <Link
                href="/contact"
                className="inline-flex items-center rounded-full bg-blue-600 hover:bg-blue-700 text-white px-8 h-11 font-medium transition-colors"
              >
                Join Our Journey <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </div>
            <div className="relative">
              <img
                src="https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=800&auto=format&fit=crop&q=60"
                alt="Modern construction"
                className="rounded-3xl shadow-2xl"
              />
              <div className="absolute -bottom-8 -left-8 bg-slate-900 rounded-2xl p-6 shadow-xl">
                <p className="text-4xl font-bold text-white">2023</p>
                <p className="text-slate-400">Founded in Sydney</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-24 bg-slate-50">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-slate-900 mb-4">Our Values</h2>
            <p className="text-xl text-slate-600 max-w-2xl mx-auto">
              The principles that guide everything we do at MMC Build.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {values.map((v) => (
              <div key={v.title} className="bg-white rounded-2xl p-8 border border-slate-200">
                <div className="h-12 w-12 bg-blue-100 rounded-xl flex items-center justify-center mb-6">
                  <v.icon className="h-6 w-6 text-blue-600" />
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-3">{v.title}</h3>
                <p className="text-slate-600">{v.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-24 bg-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-slate-900 mb-4">Leadership Team</h2>
            <p className="text-xl text-slate-600 max-w-2xl mx-auto">
              Meet the people driving innovation in construction technology.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-12 max-w-5xl mx-auto">
            {team.map((m) => (
              <div key={m.name} className="text-center">
                <img
                  src={m.image}
                  alt={m.name}
                  className="h-32 w-32 mx-auto mb-4 rounded-full object-cover border-4 border-slate-100 shadow-lg"
                />
                <h3 className="text-xl font-bold text-slate-900 mb-1">{m.name}</h3>
                <p className="text-blue-600 font-medium mb-3">{m.role}</p>
                <p className="text-sm text-slate-600 leading-relaxed">{m.bio}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-24 bg-slate-900">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold text-white mb-6">Want to join our team?</h2>
          <p className="text-xl text-slate-300 mb-8">
            We&apos;re always looking for passionate people to help build the future of construction.
          </p>
          <Link
            href="/contact"
            className="inline-flex items-center rounded-full bg-blue-600 hover:bg-blue-500 text-white px-10 h-12 text-base font-medium transition-colors"
          >
            Get in Touch <ArrowRight className="ml-2 h-5 w-5" />
          </Link>
        </div>
      </section>
    </>
  );
}
