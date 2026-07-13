export type TenantBrand = {
  name: string;
  tagline: string;
  logoUrl: string;
  colors: {
    cream: string;
    espresso: string;
    muted: string;
    clay: string;
    sand: string;
    cocoa: string;
  };
};

export type TenantConfig = {
  slug: string;
  organizationId: string;
  name: string;
  brand: TenantBrand;
  commerce: {
    orderNumberPrefix: string;
    orderNumberStart: number;
    cartStorageKey: string;
    cnyToGbpRate: number;
    defaultCurrency: "CNY" | "GBP";
  };
  email: {
    subjectSuffix: string;
    defaultCc: string;
  };
  integrations: {
    shopifyPortalTagPrefix: string;
  };
  storefront: {
    title: string;
    description: string;
    bannerText: string;
  };
};
