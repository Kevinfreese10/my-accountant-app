
import Link from 'next/link';
import { MapPin, Mail, Phone } from 'lucide-react';

const Footer = () => {
  const isProd = process.env.NODE_ENV === 'production';
  const buildId = process.env.NEXT_PUBLIC_BUILD_TIMESTAMP;

  return (
    <footer className="border-t bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            
            <div className="space-y-3">
                <h3 className="font-semibold">Contact Details</h3>
                <div className="text-sm text-muted-foreground space-y-3">
                    <div className="flex items-start gap-3">
                        <MapPin className="h-4 w-4 mt-1 flex-shrink-0" />
                        <span>
                          Clearwater Office Park<br />
                          Building 3<br />
                          Millenium Road & Christiaan de Wet Road<br />
                          Roodepoort
                        </span>
                    </div>
                    <div className="flex items-center gap-3">
                        <Mail className="h-4 w-4" />
                        <a href="mailto:info@myacc.co.za" className="hover:text-primary">info@myacc.co.za</a>
                    </div>
                     <div className="flex items-center gap-3">
                        <Phone className="h-4 w-4" />
                        <a href="tel:0101091625" className="hover:text-primary">010 109 1625</a>
                    </div>
                </div>
            </div>

            <div className="space-y-3">
                <h3 className="font-semibold">Quick Links</h3>
                 <ul className="space-y-2 text-sm">
                    <li><Link href="/about" className="text-muted-foreground hover:text-primary">About</Link></li>
                    <li><Link href="/blog" className="text-muted-foreground hover:text-primary">Blog</Link></li>
                    <li><Link href="/contact" className="text-muted-foreground hover:text-primary">Contact</Link></li>
                    <li><Link href="/compliance" className="text-muted-foreground hover:text-primary">Compliance Check</Link></li>
                    <li><Link href="/sars-compromise" className="text-muted-foreground hover:text-primary">SARS Compromise</Link></li>
                    <li><Link href="/sars-disputes" className="text-muted-foreground hover:text-primary">SARS Disputes</Link></li>
                    <li><Link href="/remission-of-fines" className="text-muted-foreground hover:text-primary">Remission of Fines</Link></li>
                    <li><Link href="/liquidations" className="text-muted-foreground hover:text-primary">Liquidations</Link></li>
                    <li><Link href="/BEI" className="text-muted-foreground hover:text-primary">Become a Partner</Link></li>
                    <li><Link href="/popia" className="text-muted-foreground hover:text-primary">POPIA Policy</Link></li>
                    <li><Link href="/refund-policy" className="text-muted-foreground hover:text-primary">Refund Policy</Link></li>
                </ul>
            </div>

            <div>
                <iframe
                    src="https://www.google.com/maps?q=Clearwater+Office+Park+Roodepoort&output=embed"
                    width="100%"
                    height="200"
                    style={{ border: 0 }}
                    allowFullScreen={false}
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                ></iframe>
            </div>

        </div>
        <div className="mt-8 border-t pt-6 text-center text-sm text-muted-foreground">
          <p>&copy; {new Date().getFullYear()} My Accountant. All rights reserved.</p>
          {buildId && (
            <p className="mt-2 text-[10px] opacity-40 font-mono select-all">Build ID: {buildId}</p>
          )}
        </div>
      </div>
    </footer>
  );
};

export default Footer;
