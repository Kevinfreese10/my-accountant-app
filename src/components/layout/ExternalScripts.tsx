'use client';

import Script from 'next/script';

export default function ExternalScripts() {
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
      <Script src="https://apis.google.com/js/platform.js" strategy="lazyOnload" />
      <Script id="google-reviews-opt-in" strategy="lazyOnload">
        {`
          window.renderOptIn = function(order) {
            if (!order || !order.order_id || !order.email || !order.estimated_delivery_date) {
              return;
            }
            if (window.gapi) {
              window.gapi.load('surveyoptin', function() {
                window.gapi.surveyoptin.render(
                  {
                    "merchant_id": 5394656984,
                    "order_id": order.order_id,
                    "email": order.email,
                    "delivery_country": "ZA",
                    "estimated_delivery_date": order.estimated_delivery_date
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
    </>
  );
}
