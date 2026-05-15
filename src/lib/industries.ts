import { Building, HardHat, Camera, User, Utensils, ShoppingCart, LucideIcon } from 'lucide-react';

export type IndustryData = {
    slug: string;
    title: string;
    description: string;
    icon: LucideIcon;
    heroTitle: string;
    heroSubtitle: string;
    content: string;
    benefits: string[];
    specialServices: string[];
};

export const industries: Record<string, IndustryData> = {
    sme: {
        slug: 'sme',
        title: 'Accounting for SMEs',
        description: 'Scalable financial management for small and medium enterprises.',
        icon: Building,
        heroTitle: 'Expert Accounting for South African SMEs',
        heroSubtitle: 'Growth-focused financial management for small and medium businesses.',
        content: 'Small and Medium Enterprises (SMEs) are the backbone of the South African economy. At My Accountant, we provide the financial structure you need to scale from a startup to an established market player. We handle the heavy lifting of compliance and bookkeeping so you can focus on leadership and innovation.',
        benefits: [
            'Fixed-fee monthly packages for easy budgeting',
            'Automated bank reconciliations to save time',
            'Regular management reports to track growth',
            'Full tax compliance (VAT, PAYE, Income Tax)'
        ],
        specialServices: [
            'Business health checks',
            'Cash flow forecasting',
            'Audit-ready financial statements',
            'CIPC maintenance and annual returns'
        ]
    },
    construction: {
        slug: 'construction',
        title: 'Accounting for Construction',
        description: 'Specialised project-based accounting and progress billing support.',
        icon: HardHat,
        heroTitle: 'Specialised Construction Industry Accounting',
        heroSubtitle: 'Project-based financial tracking for builders, contractors and engineers.',
        content: 'The construction industry has unique financial demands, from progress billing and retention tracking to complex labor costs. Our specialised construction accounting services ensure your project margins are protected and your compliance with CIDB and COIDA is always current.',
        benefits: [
            'Project-by-project profitability analysis',
            'Subcontractor payment management',
            'CIDB and COIDA compliance support',
            'Detailed expense tracking by site'
        ],
        specialServices: [
            'Progress billing support',
            'Material cost management',
            'Letter of Good Standing renewals',
            'Section 12J tax incentive advisory'
        ]
    },
    influencers: {
        slug: 'influencers',
        title: 'Accounting for Influencers',
        description: 'Tax optimization and multi-platform income tracking for creators.',
        icon: Camera,
        heroTitle: 'Tax & Accounting for Digital Creators',
        heroSubtitle: 'Maximise your creative earnings with expert tax optimization.',
        content: 'Being a digital creator in South Africa is a business, and SARS treats it as such. We help influencers and content creators navigate brand deal income, multi-platform ad revenue, and deductible business expenses (like equipment and production costs) to keep more of what they earn.',
        benefits: [
            'Optimization of deductible production expenses',
            'Tracking multi-platform ad revenue',
            'Provisional tax management to avoid penalties',
            'Brand deal invoice management'
        ],
        specialServices: [
            'Creator equipment depreciation',
            'Home office deduction advisory',
            'VAT registration for high-earning creators',
            'Personal wealth management'
        ]
    },
    freelancers: {
        slug: 'freelancers',
        title: 'Accounting for Freelancers',
        description: 'Simple, effective bookkeeping and provisional tax for independent pros.',
        icon: User,
        heroTitle: 'Stress-Free Tax for Freelancers',
        heroSubtitle: 'Reliable financial support for independent professionals and contractors.',
        content: 'Freelancing offers freedom, but tax season can be stressful. We provide simple, flat-fee solutions to help South African freelancers manage their provisional tax, claim legitimate business expenses, and maintain a clear record of their professional income.',
        benefits: [
            'Simple expense tracking tools',
            'Accurate provisional tax calculations',
            'Expert advice on tax-efficient structures',
            'Personal tax return (ITR12) submissions'
        ],
        specialServices: [
            'Tax clearance certificates',
            'Invoice design and management',
            'Medical aid and RA tax optimization',
            'Foreign income reporting'
        ]
    },
    restaurants: {
        slug: 'restaurants',
        title: 'Accounting for Restaurants',
        description: 'Inventory management and point-of-sale integration expertise.',
        icon: Utensils,
        heroTitle: 'Full-Service Restaurant Accounting',
        heroSubtitle: 'Inventory, payroll and POS integration for the hospitality sector.',
        content: 'Restaurants operate on thin margins and high transaction volumes. We provide the financial oversight needed to track food costs, manage staff payroll, and integrate your POS data directly into your accounting software for real-time visibility.',
        benefits: [
            'Daily sales and POS reconciliation',
            'Inventory and food cost tracking',
            'Complex hospitality payroll management',
            'Liquor license and health compliance support'
        ],
        specialServices: [
            'Wastage and shrinkage reporting',
            'Supplier account management',
            'VAT201 preparation for high-volume trade',
            'Lease negotiation and rental tracking'
        ]
    },
    ecommerce: {
        slug: 'ecommerce',
        title: 'Accounting for E-commerce',
        description: 'Automated VAT and multi-currency tracking for online stores.',
        icon: ShoppingCart,
        heroTitle: 'Smart Accounting for Online Stores',
        heroSubtitle: 'Scale your E-commerce business with automated financial workflows.',
        content: 'E-commerce moves fast. Whether you use Shopify, WooCommerce, or Takealot, we help you automate the flow of sales data, manage inventory values across platforms, and ensure your VAT submissions correctly handle both local and international shipments.',
        benefits: [
            'Direct integration with E-commerce platforms',
            'Multi-currency transaction support',
            'Inventory valuation and COGS tracking',
            'PayFast and payment gateway reconciliations'
        ],
        specialServices: [
            'Import/Export VAT handling',
            'Courier and shipping cost analysis',
            'Platform fee reconciliation',
            'Digital product tax advisory'
        ]
    }
};
