import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Use — MMC Build",
  description:
    "Read MMC Build's Terms of Use. Understand your rights and responsibilities when using our AI-powered construction platform and services.",
};

export default function TermsPage() {
  return (
    <>
      <section className="bg-slate-900 text-white py-16">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <h1 className="text-4xl font-bold mb-4">Terms of Use</h1>
          <p className="text-slate-300">Last updated: January 12, 2026</p>
        </div>
      </section>

      <section className="py-16 bg-white">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <div className="prose prose-slate max-w-none">
            <h2>1. Acceptance of Terms</h2>
            <p>
              By accessing and using MMC Build Pty Ltd&apos;s website and services, you accept and agree to be bound by the terms and provision of this agreement. If you do not agree to these terms, please do not use our services.
            </p>

            <h2>2. Description of Services</h2>
            <p>
              MMC Build provides AI-powered construction intelligence platform services including compliance checking, building technology recommendations, supplier directory, training programs, and quoting tools. We reserve the right to modify, suspend or discontinue any aspect of our services at any time.
            </p>

            <h2>3. User Accounts and Registration</h2>
            <p>To access certain features of our platform, you may be required to register for an account. You agree to:</p>
            <ul>
              <li>Provide accurate, current, and complete information during registration</li>
              <li>Maintain and promptly update your account information</li>
              <li>Maintain the security of your password and account</li>
              <li>Accept responsibility for all activities that occur under your account</li>
            </ul>

            <h2>4. Acceptable Use</h2>
            <p>You agree not to use our services to:</p>
            <ul>
              <li>Violate any applicable laws or regulations</li>
              <li>Infringe on intellectual property rights of others</li>
              <li>Transmit malicious code or viruses</li>
              <li>Attempt to gain unauthorised access to our systems</li>
              <li>Use the service for any illegal or unauthorised purpose</li>
              <li>Interfere with or disrupt the service or servers</li>
            </ul>

            <h2>5. Intellectual Property</h2>
            <p>
              All content, features, and functionality of MMC Build, including but not limited to text, graphics, logos, software, and AI algorithms, are owned by MMC Build Pty Ltd or its licensors and are protected by Australian and international copyright, trademark, and other intellectual property laws.
            </p>

            <h2>6. User Content</h2>
            <p>
              You retain ownership of any content you submit to our platform. By submitting content, you grant MMC Build a worldwide, non-exclusive, royalty-free licence to use, reproduce, modify, and display such content solely for the purpose of providing our services.
            </p>

            <h2>7. Payment and Subscription Terms</h2>
            <p>For paid services:</p>
            <ul>
              <li>All fees are in Australian Dollars (AUD) unless otherwise stated</li>
              <li>Subscription fees are billed in advance on a monthly or annual basis</li>
              <li>Free trial periods may be offered at our discretion</li>
              <li>You are responsible for all taxes associated with your use of the services</li>
              <li>Refunds are provided at our discretion and subject to our refund policy</li>
            </ul>

            <h2>8. Disclaimer of Warranties</h2>
            <p>
              Our services are provided &quot;as is&quot; and &quot;as available&quot; without warranties of any kind, either express or implied. While we strive to provide accurate compliance information and recommendations, users are responsible for verifying all information and ensuring compliance with applicable regulations.
            </p>

            <h2>9. Limitation of Liability</h2>
            <p>
              To the maximum extent permitted by law, MMC Build Pty Ltd shall not be liable for any indirect, incidental, special, consequential, or punitive damages, or any loss of profits or revenues, whether incurred directly or indirectly, or any loss of data, use, goodwill, or other intangible losses resulting from your use of our services.
            </p>

            <h2>10. Professional Advice Disclaimer</h2>
            <p>
              The information and recommendations provided by MMC Build are for informational purposes only and do not constitute professional advice. Users should consult with qualified professionals for specific advice regarding their construction projects and compliance requirements.
            </p>

            <h2>11. Termination</h2>
            <p>
              We reserve the right to suspend or terminate your account and access to our services at our sole discretion, without notice, for conduct that we believe violates these Terms of Use or is harmful to other users, us, or third parties, or for any other reason.
            </p>

            <h2>12. Changes to Terms</h2>
            <p>
              We reserve the right to modify these terms at any time. We will notify users of any material changes by posting the new Terms of Use on this page and updating the &quot;Last updated&quot; date. Your continued use of the service after such changes constitutes acceptance of the new terms.
            </p>

            <h2>13. Governing Law</h2>
            <p>
              These Terms of Use are governed by and construed in accordance with the laws of New South Wales, Australia. Any disputes arising from these terms shall be subject to the exclusive jurisdiction of the courts of New South Wales.
            </p>

            <h2>14. Contact Information</h2>
            <p>If you have any questions about these Terms of Use, please contact us:</p>
            <div className="bg-slate-50 rounded-lg p-6">
              <p className="font-semibold mb-1">MMC Build Pty Ltd</p>
              <p className="mb-0">ABN: 99 691 530 426</p>
              <p className="mb-0">Email: admin@mmcbuild.com.au</p>
              <p className="mb-0">Phone: 0404 394 225</p>
              <p className="mb-0">Location: New South Wales, Australia</p>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
