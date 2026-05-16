export const getTrackingUrl = (partner: string, trackingId: string): string | null => {
  if (!trackingId) return null;
  
  const normalizedPartner = partner.toLowerCase().trim();
  const id = trackingId.trim();

  if (normalizedPartner.includes('delhivery')) {
    return `https://www.delhivery.com/track/package/${id}`;
  }
  
  if (normalizedPartner.includes('blue dart')) {
    return `https://www.bluedart.com/tracking?trackid=${id}`;
  }
  
  if (normalizedPartner.includes('ecom express')) {
    return `https://ecomexpress.in/tracking/?tracking_id=${id}`;
  }
  
  if (normalizedPartner.includes('dtdc')) {
    return `https://www.dtdc.in/tracking/tracking_results.asp?SearchType=T&TNo0=${id}`;
  }

  if (normalizedPartner.includes('india post')) {
    return `https://www.indiapost.gov.in/_layouts/15/dop.portal.tracking/trackconsignment.aspx`;
  }

  // Default fallback if partner is unknown but ID exists
  return `https://www.google.com/search?q=track+${normalizedPartner}+${id}`;
};
