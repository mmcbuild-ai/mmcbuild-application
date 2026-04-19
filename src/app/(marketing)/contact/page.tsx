import type { Metadata } from "next";
import { Mail, Phone, MapPin } from "lucide-react";
import ContactForm from "@/components/marketing/contact-form";

export const metadata: Metadata = {
  title: "Contact MMC Build — Get in Touch with Our Team",
  description:
    "Have questions about Modern Methods of Construction? Contact MMC Build for expert guidance on compliance, training, or joining our verified trades directory.",
};

export default function ContactPage() {
  return (
    <>
      <section className="relative bg-[#0f172a] text-white overflow-hidden py-16">
        <div className="absolute top-0 left-1/2 w-[800px] h-[400px] -translate-x-1/2 bg-blue-600/20 blur-[100px] rounded-full pointer-events-none" />
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center z-10">
          <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl lg:text-6xl mb-6">
            Let&apos;s Build the Future — Properly
          </h1>
          <p className="mx-auto max-w-2xl text-xl text-slate-300">
            Have questions? We&apos;d love to hear from you. Get in touch with our team.
          </p>
        </div>
      </section>

      <section className="py-24 bg-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-16">
            <div>
              <h2 className="text-2xl font-bold text-slate-900 mb-6">Get in Touch</h2>

              <p className="text-slate-700 font-medium mb-4">Whether you&apos;re:</p>
              <ul className="space-y-3 mb-8 text-slate-700">
                <li className="flex items-start gap-3">
                  <span className="text-blue-600 mt-1 font-bold">•</span>
                  <span>Exploring Modern Methods of Construction for the first time</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-blue-600 mt-1 font-bold">•</span>
                  <span>Looking to upskill your team with industry-leading MMC training</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-blue-600 mt-1 font-bold">•</span>
                  <span>Interested in becoming a verified supplier in our directory</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-blue-600 mt-1 font-bold">•</span>
                  <span>Seeking faster, safer compliance with Australian building standards</span>
                </li>
              </ul>
              <p className="text-slate-800 font-semibold text-lg mb-8">
                We&apos;re here to help you succeed.
              </p>

              <div className="space-y-6 mb-12">
                <div className="flex items-start gap-4">
                  <div className="h-12 w-12 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Mail className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-900">Email</h3>
                    <p className="text-slate-600">admin@mmcbuild.com.au</p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="h-12 w-12 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Phone className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-900">Phone</h3>
                    <p className="text-slate-600">0404 394 225</p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="h-12 w-12 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
                    <MapPin className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-900">Location</h3>
                    <p className="text-slate-600">New South Wales, Australia</p>
                  </div>
                </div>
              </div>

              <div className="bg-slate-50 rounded-2xl p-8">
                <h3 className="font-semibold text-slate-900 mb-4">Office Hours</h3>
                <div className="space-y-2 text-slate-600">
                  <div className="flex justify-between">
                    <span>Monday – Friday</span>
                    <span>9:00 AM – 6:00 PM AEST</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Saturday – Sunday</span>
                    <span>Closed</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-slate-50 rounded-2xl p-8">
              <ContactForm />
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
