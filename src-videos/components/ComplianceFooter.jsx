import React from 'react';
import { useTranslation } from 'react-i18next';

const complianceStyles = `
.compliance-footer {
    background: linear-gradient(135deg, #0f172a 0%, #020617 100%);
    color: #94a3b8;
    padding: 30px 20px 120px 20px;
    font-size: 12px;
    line-height: 1.6;
    text-align: center;
    border-top: 1px solid #1e293b;
    margin-top: 30px;
}
.compliance-footer a {
    color: #818cf8;
    text-decoration: none;
    transition: color 0.2s;
}
.compliance-footer a:hover {
    text-decoration: underline;
    color: #a5b4fc;
}
.compliance-links {
    margin-bottom: 20px;
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 8px 20px;
}
.compliance-links a {
    padding: 5px 0;
    display: inline-block;
}
.compliance-warning {
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.3);
    border-radius: 8px;
    padding: 15px 20px;
    margin: 0 auto 20px auto;
    max-width: 700px;
    color: #fca5a5;
}
.compliance-text {
    max-width: 800px;
    margin: 0 auto 20px auto;
    color: #64748b;
}
.compliance-badges {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 15px;
    margin: 20px 0;
}
.compliance-badge {
    opacity: 0.9;
    transition: opacity 0.2s;
}
.compliance-badge:hover {
    opacity: 1;
}
.compliance-copyright {
    color: #475569;
    margin-top: 20px;
    padding-top: 20px;
    border-top: 1px solid #1e293b;
}
.compliance-copyright span {
    font-size: 11px;
    color: #334155;
    display: block;
    margin-top: 8px;
}
.pride-bar {
    height: 3px;
    background: linear-gradient(90deg, #e40303, #ff8c00, #ffed00, #008026, #004dff, #750787);
    margin-bottom: 25px;
}
.network-links {
    margin-bottom: 20px;
}
.network-links a {
    margin: 0 12px;
    color: #fbbf24;
}
`;

function ComplianceFooter({ siteName = 'BoyVue', showNetworkLinks = true }) {
  const { t } = useTranslation();
  const currentYear = new Date().getFullYear();

  return (
    <>
      <style>{complianceStyles}</style>
      <div className="compliance-footer">
        <div className="pride-bar"></div>

        <div className="compliance-warning">
          <strong>WARNING:</strong> {t('compliance.warning', 'This website contains sexually explicit material. You must be at least 18 years of age (or the age of majority in your jurisdiction) to enter.')}
        </div>

        <div className="compliance-links">
          <a href="https://boyvue.com/legal/2257.html">{t('compliance.2257', '18 U.S.C. 2257 Compliance')}</a>
          <a href="https://boyvue.com/legal/tos.html">{t('compliance.tos', 'Terms of Service')}</a>
          <a href="https://boyvue.com/legal/privacy.html">{t('compliance.privacy', 'Privacy Policy')}</a>
          <a href="https://boyvue.com/legal/dmca.html">{t('compliance.dmca', 'DMCA / Content Removal')}</a>
          <a href="mailto:support@boyvue.com">{t('compliance.contact', 'Contact Us')}</a>
        </div>

        {showNetworkLinks && (
          <div className="network-links">
            <a href="https://boyvue.com">BoyVue</a>
            <a href="https://pics.boyvue.com">Pics</a>
            <a href="https://videos.boyvue.com">Videos</a>
            <a href="https://adult.boyvue.com">Adult</a>
            <a href="https://fans.boyvue.com">Fans</a>
            <a href="https://creatives.boyvue.com">Creatives</a>
          </div>
        )}

        <div className="compliance-text">
          {t('compliance.modelsNotice', 'All models appearing on this website are 18 years of age or older. All content is produced in compliance with 18 U.S.C. 2257 record-keeping requirements.')}
          <br /><br />
          {t('compliance.rtaNotice', 'This site is labeled with the RTA (Restricted to Adults) label. Parents, you can easily block access to this site using parental control software.')}
        </div>

        <div className="compliance-badges">
          <a href="https://www.rtalabel.org/" target="_blank" rel="nofollow noopener" className="compliance-badge" title="RTA Label">
            <img src="https://boyvue.com/assets/compliance/rta-badge.svg" alt="RTA Label" width="88" height="33" />
          </a>
          <a href="https://www.asacp.org/" target="_blank" rel="nofollow noopener" className="compliance-badge" title="ASACP">
            <img src="https://boyvue.com/assets/compliance/asacp-badge.svg" alt="ASACP" width="100" height="32" />
          </a>
        </div>

        <div className="compliance-copyright">
          &copy; 2020-{currentYear} {siteName}.com - {t('compliance.copyright', 'All Rights Reserved')}
          <span>
            {t('compliance.depictionNotice', 'All depicted models were at least 18 years old at the time of photography.')}
            <br />
            {t('compliance.zeroTolerance', 'We have a zero-tolerance policy against illegal content.')}
          </span>
        </div>
      </div>
    </>
  );
}

export default ComplianceFooter;
