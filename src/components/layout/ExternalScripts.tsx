'use client';

import Script from 'next/script';
import { usePathname } from 'next/navigation';

export default function ExternalScripts() {
  const pathname = usePathname();
  // Check if the current route is a partner landing page
  const isPartnerPage = pathname?.startsWith('/p/');

  return (
    <>
      <Script
        async
        src="https://www.googletagmanager.com/gtag/js?id=G-KBTZN40DGY"
        strategy="afterInteractive"
      />
      <Script id="google-analytics" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', 'G-KBTZN40DGY');
        `}
      </Script>
      
      {/* Google Customer Reviews Platform Script */}
      <Script src="https://apis.google.com/js/platform.js?onload=renderOptIn" strategy="lazyOnload" />
      
      <Script id="google-reviews-opt-in" strategy="lazyOnload">
        {`
          window.renderOptIn = function(orderData) {
            if (!orderData || !orderData.id || !orderData.customerEmail || !orderData.estimated_delivery_date) {
              console.warn('Google Review Opt-in: Missing mandatory order data.');
              return;
            }
            if (window.gapi) {
              window.gapi.load('surveyoptin', function() {
                window.gapi.surveyoptin.render(
                  {
                    "merchant_id": 5394656984,
                    "order_id": orderData.id,
                    "email": orderData.customerEmail,
                    "delivery_country": "ZA",
                    "estimated_delivery_date": orderData.estimated_delivery_date
                  });
              });
            }
          }
        `}
      </Script>

      <Script
        id="merchant-widget"
        src="https://www.gstatic.com/shopping/merchant/merchantwidget.js"
        strategy="lazyOnload"
        onLoad={() => {
          // @ts-ignore
          if (window.merchantwidget) {
            // @ts-ignore
            window.merchantwidget.start({
              merchant_id: 5394656984,
              position: "BOTTOM_RIGHT",
              region: "ZA",
            });
          }
        }}
      />
      {/* Only show the respond.io widget if we are NOT on a partner landing page */}
      {!isPartnerPage && (
        <Script
          id="respondio__growth_tool"
          src="https://cdn.respond.io/widget/widget.js?wId=85c13926-c3bd-40f9-9535-9f8e052e2bc4"
          strategy="lazyOnload"
        />
      )}
    </>
  );
}
