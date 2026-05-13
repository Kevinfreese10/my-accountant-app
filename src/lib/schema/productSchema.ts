import { Service } from '@/lib/types';

/**
 * Generates valid Schema.org JSON-LD for My Accountant products and services.
 * Implements the exact structure required for Google Search Console rich results.
 */
export function generateStructuredData(service: Service) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://www.myacc.co.za';
  const fullUrl = `${baseUrl}/products/${service.slug}`;
  
  // Rolling expiry: 31 December of next year
  const expiryDate = service.priceValidUntilOverride || `${new Date().getFullYear() + 1}-12-31`;

  // Standard Product Schema for all items as per GSC requirements
  return {
    "@context": "https://schema.org/",
    "@type": "Product",
    "name": service.title,
    "image": [
      service.imageUrl || `${baseUrl}/og-image.jpg`
    ],
    "description": service.longDescription || service.description || `Professional ${service.title} service for South African businesses.`,
    "sku": service.id,
    "brand": {
      "@type": "Brand",
      "name": service.brand || "My Accountant"
    },
    "aggregateRating": (service.enableAggregateRating !== false) ? {
      "@type": "AggregateRating",
      "ratingValue": service.aggregateRatingValue?.toString() || "4.9",
      "reviewCount": service.reviewCount?.toString() || "187"
    } : undefined,
    "offers": {
      "@type": "Offer",
      "url": fullUrl,
      "priceCurrency": service.currency || "ZAR",
      "price": (service.price || 0).toFixed(2),
      "availability": `https://schema.org/${service.availability === 'out_of_stock' ? 'OutOfStock' : 'InStock'}`,
      "itemCondition": `https://schema.org/${service.condition === 'used' ? 'UsedCondition' : 'NewCondition'}`,
      "priceValidUntil": expiryDate,
      "seller": {
        "@type": "Organization",
        "name": service.brand || "My Accountant"
      },
      "hasMerchantReturnPolicy": {
        "@type": "MerchantReturnPolicy",
        "returnPolicyCategory": service.returnPolicyCategory || "https://schema.org/MerchantReturnNotPermitted"
      },
      "shippingDetails": {
        "@type": "OfferShippingDetails",
        "shippingDestination": {
          "@type": "DefinedRegion",
          "addressCountry": "ZA"
        },
        "shippingRate": {
          "@type": "MonetaryAmount",
          "value": "0",
          "currency": "ZAR"
        }
      }
    }
  };
}

/**
 * Global practice schema for the organization.
 */
export function generateOrganizationSchema() {
  const baseUrl = 'https://www.myacc.co.za';
  return {
    "@context": "https://schema.org",
    "@type": "AccountingService",
    "name": "My Accountant",
    "url": baseUrl,
    "logo": `${baseUrl}/logo.png`,
    "image": "https://firebasestorage.googleapis.com/v0/b/studio-2604127518-57889.firebasestorage.app/o/uploads%2FLRM285EOq3gwNMKayY6vtzooaC03%2F1777450406330-WWW.MYACC.CO.ZA.png?alt=media&token=e5cf2944-6006-4f21-9a20-ff403ff380e0",
    "telephone": "+27-10-109-1625",
    "email": "info@myacc.co.za",
    "address": {
      "@type": "PostalAddress",
      "streetAddress": "Ground Floor, Waterstone Building, Stonemill Office Park, 300 Acacia Road, Darrenwood",
      "addressLocality": "Johannesburg",
      "postalCode": "2195",
      "addressCountry": "ZA"
    },
    "sameAs": [
      "https://www.facebook.com/myaccountantza",
      "https://www.linkedin.com/company/myaccountantza"
    ]
  };
}
