// Kant-en-klare integratie-recepten voor Zapier / Make (Integromat) en generieke
// automatisering. Deze beschrijven hoe je de bestaande in- en uitgaande webhooks
// koppelt. Puur informatief (geen geheimen); de UI/​docs tonen ze als sjabloon.

export function recipes(baseUrl = 'https://transfer.voorbeeld.nl') {
  return [
    {
      id: 'zapier-inbound-backup',
      name: 'Zapier → back-up starten',
      direction: 'inbound',
      description: 'Laat een Zap (bijv. dagelijks of bij een e-mail) een back-up van de fileserver starten.',
      steps: [
        'Maak in het beheer een inkomende hook met actie "backup" en kopieer de token.',
        'Zapier: kies actie "Webhooks by Zapier" → "POST".',
        `URL: ${baseUrl}/api/hooks/<token>`,
        'Method: POST, Data: leeg (of {"message":"..."}).',
      ],
    },
    {
      id: 'make-inbound-reindex',
      name: 'Make → zoekindex herbouwen',
      direction: 'inbound',
      description: 'Herbouw de zoekindex nadat een extern proces bestanden heeft geplaatst.',
      steps: [
        'Maak een inkomende hook met actie "reindex".',
        'Make: module "HTTP → Make a request".',
        `URL: ${baseUrl}/api/hooks/<token>, Method: POST.`,
      ],
    },
    {
      id: 'outbound-upload-notify',
      name: 'Uitgaand → melding bij upload/alert',
      direction: 'outbound',
      description: 'Stuur gebeurtenissen (uploads, alerts) naar een Zapier/Make-webhook via de uitgaande webhook-wachtrij.',
      steps: [
        'Maak in Zapier/Make een "Catch Hook" trigger en kopieer de URL.',
        'Zet WEBHOOK_URL in .env op die URL (WEBHOOK_TYPE=json).',
        'De server levert events betrouwbaar af (met retries) aan je scenario.',
      ],
    },
  ];
}
