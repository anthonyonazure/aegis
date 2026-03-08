import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

export default function TermsOfService() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-3xl mx-auto px-6 py-12">
        <Button variant="ghost" size="sm" asChild className="mb-8">
          <Link to="/"><ArrowLeft className="h-4 w-4 mr-2" /> Back</Link>
        </Button>

        <h1 className="text-3xl font-bold mb-2">Terms of Service</h1>
        <p className="text-muted-foreground mb-8">Last updated: March 8, 2026</p>

        <div className="prose prose-sm dark:prose-invert space-y-6">
          <section>
            <h2 className="text-xl font-semibold mb-3">1. Acceptance of Terms</h2>
            <p className="text-muted-foreground">By accessing or using PolicyForge, you agree to be bound by these Terms of Service. If you do not agree, do not use the platform.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">2. Description of Service</h2>
            <p className="text-muted-foreground">PolicyForge is an AI-powered platform for Managed Service Providers (MSPs) to manage Microsoft 365 tenant configurations, enforce compliance policies, detect drift, and generate governance reports across multiple tenants.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">3. Account Responsibilities</h2>
            <p className="text-muted-foreground">You are responsible for maintaining the confidentiality of your account credentials and for all activity under your account. You must notify us immediately of any unauthorized use. Access is controlled via invite codes issued by administrators.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">4. Acceptable Use</h2>
            <p className="text-muted-foreground">You agree not to misuse the platform, including but not limited to: attempting to bypass rate limits, accessing other users' data, reverse engineering the platform, or using the service for any unlawful purpose.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">5. Data & Tenant Access</h2>
            <p className="text-muted-foreground">You grant PolicyForge permission to access your Microsoft 365 tenants solely to provide the services described. You are responsible for ensuring you have authorization to connect each tenant. PolicyForge acts as a processor of your tenant data.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">6. AI Features</h2>
            <p className="text-muted-foreground">AI-generated recommendations, analyses, and reports are provided for informational purposes only. You should review all AI outputs before acting on them. PolicyForge is not liable for actions taken based on AI recommendations.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">7. Limitation of Liability</h2>
            <p className="text-muted-foreground">PolicyForge is provided "as is" without warranties of any kind. We are not liable for any indirect, incidental, or consequential damages arising from your use of the platform, including data loss or configuration changes made through the service.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">8. Termination</h2>
            <p className="text-muted-foreground">We may suspend or terminate your access at any time for violation of these terms. You may close your account at any time by contacting support.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">9. Changes to Terms</h2>
            <p className="text-muted-foreground">We may update these terms from time to time. Continued use of the platform after changes constitutes acceptance. We will notify you of material changes via email or in-app notification.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">10. Contact</h2>
            <p className="text-muted-foreground">For questions about these terms, please contact us at legal@policyforge.io.</p>
          </section>
        </div>
      </div>
    </div>
  );
}
