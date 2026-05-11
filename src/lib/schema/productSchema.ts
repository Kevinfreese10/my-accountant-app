import { Service } from '@/lib/types';

/**
 * Generates valid Schema.org JSON-LD for My Accountant products and services.
 * Dynamically switches between Product and Service schema to prevent GSC errors.
 */
export function generateStructuredData(service: Service) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://www.myacc.co.za';
  const fullUrl = `${baseUrl}/products/${service.slug}`;
  
  // Decide schema type: Use Service if TBC or explicitly requested, otherwise Product.
  const isTbc = service.isPriceTbc || !service.price || service.price === 0;
  const type = service.schemaType || (isTbc ? 'Service' : 'Product');

  const common = {
    '@context': 'https://schema.org',
    name: service.title,
    description: service.description || service.metaDescription,
    url: fullUrl,
    image: service.imageUrl || `${baseUrl}/og-image.jpg`,
    provider: {
      '@type': 'AccountingService',
      name: service.brand || 'My Accountant',
      url: baseUrl,
      logo: `${baseUrl}/logo.png`,
    },
  };

  // Truthful practice-wide rating data
  const aggregateRating = (service.enableAggregateRating !== false) ? {
    '@type': 'AggregateRating',
    ratingValue: service.aggregateRatingValue?.toString() || '4.9',
    reviewCount: service.reviewCount?.toString() || '190',
    bestRating: '5',
    worstRating: '1',
  } : undefined;

  if (type === 'Product') {
    // Dynamic rolling expiry for pricing: End of next year
    const expiryDate = service.priceValidUntilOverride || `${new Date().getFullYear() + 1}-12-31`;

    return {
      ...common,
      '@type': 'Product',
      sku: service.id,
      brand: common.provider,
      offers: {
        '@type': 'Offer',
        url: fullUrl,
        priceCurrency: service.currency || 'ZAR',
        price: service.price.toFixed(2),
        priceValidUntil: expiryDate,
        availability: `https://schema.org/${service.availability === 'out_of_stock' ? 'OutOfStock' : 'InStock'}`,
        itemCondition: `https://schema.org/${service.condition === 'used' ? 'UsedCondition' : 'NewCondition'}`,
        hasMerchantReturnPolicy: {
          '@type': 'MerchantReturnPolicy',
          applicableCountry: 'ZA',
          returnPolicyCategory: service.returnPolicyCategory || 'https://schema.org/MerchantReturnNotPermitted',
          merchantReturnLink: `${baseUrl}/refund-policy`,
        },
      },
      aggregateRating,
    };
  }

  // Fallback: Service Schema (Safest for TBC items as it doesn't require 'offers')
  return {
    ...common,
    '@type': 'Service',
    serviceType: service.category || 'Financial Service',
    areaServed: 'ZA',
    aggregateRating,
  };
}

/**
 * Global practice schema.
 */
export function generateOrganizationSchema() {
  const baseUrl = 'https://www.myacc.co.za';
  return {
    '@context': 'https://schema.org',
    '@type': 'AccountingService',
    name: 'My Accountant',
    url: baseUrl,
    logo: `${baseUrl}/logo.png`,
    image: 'https://firebasestorage.googleapis.com/v0/b/studio-2604127518-57889.firebasestorage.app/o/uploads%2FLRM285EOq3gwNMKayY6vtzooaC03%2F1777450406330-WWW.MYACC.CO.ZA.png?alt=media&token=e5cf2944-6006-4f21-9a20-ff403ff380e0',
    telephone: '+27-10-109-1625',
    email: 'info@myacc.co.za',
    address: {
      '@type': 'PostalAddress',
      streetAddress: 'Ground Floor, Waterstone Building, Stonemill Office Park, 300 Acacia Road, Darrenwood',
      addressLocality: 'Johannesburg',
      postalCode: '2195',
      addressCountry: 'ZA',
    },
    openingHoursSpecification: [
      {
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
        opens: '08:00',
        closes: '17:00',
      },
    ],
    sameAs: [
      'https://www.facebook.com/myaccountantza',
      'https://www.linkedin.com/company/myaccountantza',
    ],
  };
}
