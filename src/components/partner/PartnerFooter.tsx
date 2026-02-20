import { User } from "@/lib/types";
import { Mail, MapPin, Phone } from "lucide-react";
import Link from "next/link";

export default function PartnerFooter({ partner }: { partner: User }) {
  const primaryColor = partner.landingPage?.primaryColor || '#214392';

  return (
    <footer className="border-t bg-muted/30">
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
          <div className="space-y-4">
            <h3 className="font-bold text-lg" style={{ color: primaryColor }}>{partner.companyName || partner.name}</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {partner.landingPage?.heroSubtitle}
            </p>
          </div>

          <div className="space-y-4">
            <h3 className="font-semibold text-sm uppercase tracking-wider">Contact Details</h3>
            <div className="space-y-3 text-sm text-muted-foreground">
              <div className="flex items-start gap-3">
                <MapPin className="h-4 w-4 mt-1 flex-shrink-0" style={{ color: primaryColor }} />
                <span>
                  {partner.address?.street}<br />
                  {partner.address?.suburb ? `${partner.address.suburb}, ` : ''}
                  {partner.address?.city}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <Mail className="h-4 w-4" style={{ color: primaryColor }} />
                <a href={`mailto:${partner.email}`} className="hover:underline">{partner.email}</a>
              </div>
              {partner.contactNumber && (
                <div className="flex items-center gap-3">
                  <Phone className="h-4 w-4" style={{ color: primaryColor }} />
                  <a href={`tel:${partner.contactNumber}`} className="hover:underline">{partner.contactNumber}</a>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="font-semibold text-sm uppercase tracking-wider">Legal</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              {partner.landingPage?.popiaPolicy && (
                <li><Link href={`/p/${partner.landingPage.slug}/popia`} className="hover:underline">POPIA Policy</Link></li>
              )}
              {partner.landingPage?.refundPolicy && (
                <li><Link href={`/p/${partner.landingPage.slug}/refund-policy`} className="hover:underline">Refund Policy</Link></li>
              )}
              {partner.landingPage?.termsAndConditions && (
                <li><Link href={`/p/${partner.landingPage.slug}/terms`} className="hover:underline">Terms & Conditions</Link></li>
              )}
            </ul>
          </div>
        </div>
        
        <div className="mt-12 pt-8 border-t text-center text-xs text-muted-foreground">
          <p>&copy; {new Date().getFullYear()} {partner.companyName || partner.name}. All rights reserved.</p>
          <p className="mt-2 opacity-50 italic">Powered by My Accountant Partner Network</p>
        </div>
      </div>
    </footer>
  );
}