import React from 'react';
import { useTranslation } from 'react-i18next';

export default function ComplianceFooter({ siteName = 'BoyVue', showAffiliate = true }) {
  const { t } = useTranslation();
  const year = new Date().getFullYear();

  const styles = {
    footer: {
      background: '#0d0d1a',
      padding: '30px 20px',
      borderTop: '1px solid #222',
      marginTop: 'auto',
    },
    container: {
      maxWidth: '1200px',
      margin: '0 auto',
    },
    links: {
      display: 'flex',
      flexWrap: 'wrap',
      gap: '15px',
      justifyContent: 'center',
      marginBottom: '20px',
    },
    link: {
      color: '#888',
      textDecoration: 'none',
      fontSize: '13px',
    },
    compliance: {
      textAlign: 'center',
      color: '#666',
      fontSize: '12px',
      lineHeight: '1.6',
    },
    network: {
      display: 'flex',
      justifyContent: 'center',
      gap: '20px',
      marginBottom: '15px',
    },
    networkLink: {
      color: '#00d4ff',
      textDecoration: 'none',
      fontSize: '13px',
    },
  };

  return (
    <footer style={styles.footer}>
      <div style={styles.container}>
        {/* Network Links */}
        <div style={styles.network}>
          <a href="https://boyvue.com" style={styles.networkLink}>{t('network.main', 'BoyVue')}</a>
          <a href="https://pics.boyvue.com" style={styles.networkLink}>{t('network.pics', 'Pics')}</a>
          <a href="https://videos.boyvue.com" style={styles.networkLink}>{t('network.videos', 'Videos')}</a>
          <a href="https://adult.boyvue.com" style={styles.networkLink}>{t('network.adult', 'Adult')}</a>
          <a href="https://fans.boyvue.com" style={styles.networkLink}>{t('network.fans', 'Fans')}</a>
        </div>

        {/* Legal Links */}
        <div style={styles.links}>
          <a href="/privacy" style={styles.link}>{t('compliance.privacyPolicy', 'Privacy Policy')}</a>
          <a href="/terms" style={styles.link}>{t('compliance.termsOfService', 'Terms of Service')}</a>
          <a href="/cookies" style={styles.link}>{t('compliance.cookiePolicy', 'Cookie Policy')}</a>
          <a href="/2257" style={styles.link}>{t('compliance.usCompliance', '18 U.S.C. 2257')}</a>
          <a href="/dmca" style={styles.link}>{t('compliance.dmcaNotice', 'DMCA')}</a>
          <a href="/contact" style={styles.link}>{t('compliance.contactUs', 'Contact Us')}</a>
        </div>

        {/* Compliance Statements */}
        <div style={styles.compliance}>
          <p>{t('compliance.fullNotice', 'All models 18+ at time of depiction. RTA Labeled.')}</p>
          {showAffiliate && (
            <p>{t('compliance.affiliateDisclosure', 'This site contains affiliate links. We may earn commissions from purchases made through these links.')}</p>
          )}
          <p>&copy; {year} {siteName}.com - {t('compliance.copyright', 'All rights reserved.')}</p>
        </div>
      </div>
    </footer>
  );
}
