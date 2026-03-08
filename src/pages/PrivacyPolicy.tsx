import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-3xl mx-auto px-6 py-12">
        <Button variant="ghost" size="sm" asChild className="mb-8">
          <Link to="/"><ArrowLeft className="h-4 w-4 mr-2" /> Back</Link>
        </Button>

        <h1 className="text-3xl font-bold mb-2">Privacy Policy</h1>
        <p className="text-muted-foreground mb-8">Last updated: March 8, 2026</p>

        <div className="prose prose-sm dark:prose-invert space-y-6">
          <section>
            <h2 className="text-xl font-semibold mb-3">1. Information We Collect</h2>
            <p className="text-muted-foreground">We collect information you provide directly, including your email address, name, and Microsoft 365 tenant configuration data when you use PolicyForge. We also collect usage data such as feature interactions and session metadata to improve the platform.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">2. How We Use Your Information</h2>
            <p className="text-muted-foreground">Your information is used to provide and improve our services, including tenant configuration management, compliance analysis, AI-powered insights, and customer support. We do not sell your personal data to third parties.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">3. Data Storage & Security</h2>
            <p className="text-muted-foreground">All data is stored securely using industry-standard encryption. Tenant credentials are encrypted using vault-level encryption. We implement role-based access controls and audit logging to protect your data.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">4. Third-Party Services</h2>
            <p className="text-muted-foreground">PolicyForge integrates with Microsoft Graph API, AI providers, and PSA tools at your direction. Data shared with these services is governed by their respective privacy policies. We only transmit the minimum data necessary for each integration.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">5. Data Retention</h2>
            <p className="text-muted-foreground">We retain your data for as long as your account is active. You may request deletion of your account and associated data at any time by contacting support.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">6. Your Rights</h2>
            <p className="text-muted-foreground">You have the right to access, correct, or delete your personal data. You may also request a copy of your data in a portable format. To exercise these rights, contact us at the email provided below.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">7. Contact</h2>
            <p className="text-muted-foreground">For privacy-related questions, please contact us at privacy@policyforge.io.</p>
          </section>
        </div>
      </div>
    </div>
  );
}
