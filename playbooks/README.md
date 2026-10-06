# playbooks/

Trabajos completos que encadenan Skills. Cada fichero es el contenido del Playbook registrado en Devin (mismo texto); el repo es la fuente de verdad y se sincroniza a mano o por PR.

| Playbook | Cuándo | Skills que encadena |
|---|---|---|
| `account-onboarding.md` | Alta de cuenta | account-research → stakeholder-mapping → meddpicc-plan → power-map-review |
| `pg-activation.md` | Arrancar prospección de un sales play | signal-sweep → pg-cadence-writer |
| `meeting-brief.md` | Antes de una reunión | power-map-review (+ research) |
| `meeting-debrief.md` | Después de una reunión | stakeholder-mapping → meddpicc-plan → power-map-review → deal-risk-review |
| `weekly-deal-review.md` | Semanal / pre-forecast (Automation) | signal-sweep → deal-risk-review → power-map-review |

Sin integraciones por ahora: nada envía emails ni escribe en el CRM; toda salida es un PR y, opcionalmente, un mensaje en Slack.
