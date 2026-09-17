"""One-off enrichment of the v0.1 dataset to the v0.2 schema (additive only)."""
import json, pathlib

ROOT = pathlib.Path(__file__).resolve().parents[1] / 'src' / 'data'
UNK = 'UNKNOWN'
HYP = 'HYPOTHESIS — VALIDATION REQUIRED'
TODAY = '2026-09-17'


def load(n):
    return json.load(open(ROOT / n))


def save(n, d):
    json.dump(d, open(ROOT / n, 'w'), ensure_ascii=False, indent=2)
    open(ROOT / n, 'a').write('\n')


accounts = load('accounts.json')
stakeholders = load('stakeholders.json')
opps = load('opportunities.json')
signals = load('signals.json')

A = {a['id']: a for a in accounts}

# ---------------------------------------------------------------- technology
tech = {
    'mapfre': dict(
        technologyStrategy='Technology is one of six pillars of Strategic Plan 2024-2026; Group Technology & Data area led by Vanessa Escrivá (FACT).',
        cloudStrategy='REEF core platform is cloud-based; MAPFRE Copilot runs on Azure OpenAI (FACT). Wider cloud provider mix: ' + UNK,
        aiStrategy='AI Centre with 90+ use cases; AI Manifesto (first IBEX 35) governing human-centred, ethical AI (FACT).',
        generativeAI='MAPFRE Copilot (internal GenAI assistant on Azure OpenAI) deployed to employees (FACT).',
        agenticAI='Territory plan lists a Head of Agentic Architecture & Technological Innovation and an Agent Architecture Manager (TERRITORY PLAN). Scope of agent programme: ' + UNK,
        softwareEngineering='REEF engineering: automation, observability, CI/CD (FACT, job posting). Team size and delivery model: ' + UNK,
        developerProductivity='Coding-assistant tooling (GitHub Copilot or other): ' + UNK,
        digitalTransformation='Multi-country platform standardisation (REEF) and digital/operational transformation pillar (FACT).',
        applicationModernization='REEF rollout to 11 additional countries, €65m, 3 years (FACT).',
        legacyEnvironment='MAPFRE Insurance USA legacy AS/400 policy admin being retired (Guidewire/Duck Creek) (FACT). Other country cores: ' + UNK,
        data='Group Chief Technology and Data Officer role combines technology and data (FACT). Data platform details: ' + UNK,
        cybersecurity='CISO identified in territory plan (José Antonio Ledesma) (TERRITORY PLAN). Security constraints on AI/model bias cited publicly (FACT).',
    ),
    'caixabank': dict(
        technologyStrategy='>€5bn technology investment 2025-2027; internalising development through CaixaBank Tech (FACT).',
        cloudStrategy='Hybrid/multi-cloud; CTO Office ran cloud landing zones; Azure and GCP referenced in agent-framework evaluation (SOURCE-BASED INTERPRETATION).',
        aiStrategy='GenAI to enhance commercial and service capabilities; cognitive platform based on AI agents (FACT).',
        generativeAI='GenAI in production for commercial/service use cases; Salesforce Agentforce/Data Cloud relationship (FACT).',
        agenticAI='AI-agent framework and cognitive platform under development at CaixaBank Tech (FACT).',
        softwareEngineering='CaixaBank Tech >1,600 staff, target ~2,000; hubs in Barcelona, Madrid, Seville (FACT).',
        developerProductivity='Coding-assistant tooling status: ' + UNK,
        digitalTransformation='Strategic Plan 2025-2027 pillar: drive business transformation and investment (FACT).',
        applicationModernization='Channel and infrastructure upgrade for resilience (FACT). Core banking modernisation scope: ' + UNK,
        legacyEnvironment=UNK + ' — mainframe/core footprint not publicly detailed',
        data='DataNow platform evolving towards agent-based cognitive platform (FACT).',
        cybersecurity='Regulated entity (ECB/DORA); resilience explicitly in plan (FACT). Security organisation contacts: ' + UNK,
    ),
    'bankinter': dict(
        technologyStrategy='Technology & Transformation organisation under CIO; AI governance under CAITO (FACT).',
        cloudStrategy=UNK,
        aiStrategy="'IA First' CEO-led programme; new AI governance model with CAITO (FACT).",
        generativeAI='Microsoft 365 Copilot deployed organisation-wide (FACT).',
        agenticAI='AI agents mentioned for employee productivity (FACT). Engineering agents: ' + UNK,
        softwareEngineering='Delivery model (in-house vs SI) and team size: ' + UNK,
        developerProductivity='GitHub Copilot status: ' + UNK + ' (Microsoft-centric stack makes it plausible — SALES HYPOTHESIS)',
        digitalTransformation='CDO-led digital transformation; EVO Banco digital bank (FACT).',
        applicationModernization=UNK,
        legacyEnvironment=UNK,
        data=UNK,
        cybersecurity=UNK,
    ),
    'amadeus': dict(
        technologyStrategy='>€1.4bn R&D (>20% revenue); Open Platform and Nevio; cloud-first (FACT).',
        cloudStrategy='Largest IT programme: >50% applications migrated by Feb 2025; Microsoft Azure primary, Google multi-cloud (FACT).',
        aiStrategy='AI and agentic AI scaled across products and operations (FACT).',
        generativeAI='Internal LLM, GenAI test generation, GenAI for operations troubleshooting (FACT).',
        agenticAI='First batch of six AI agents; Amadeus Advisor (FACT).',
        softwareEngineering='>10,000-strong engineering community (FACT, CTO bio).',
        developerProductivity='GitHub Copilot deployed (FACT).',
        digitalTransformation='Operating-model change so developers are more empowered (FACT).',
        applicationModernization='Remaining application estate still migrating to cloud (FACT).',
        legacyEnvironment='Mainframe/legacy remainder of the estate not migrated: ' + UNK,
        data='Data platforms: ' + UNK,
        cybersecurity='CISO reports under CTO (SOURCE-BASED INTERPRETATION).',
    ),
    'acciona': dict(
        technologyStrategy='Digital transformation via AI: MIRAI programme and Digital Hub (FACT).',
        cloudStrategy=UNK,
        aiStrategy='MIRAI co-finances AI/automation projects; Energía Data & AI strategy (FACT).',
        generativeAI='Document management prioritised in MIRAI first edition (FACT). GenAI tooling: ' + UNK,
        agenticAI=UNK,
        softwareEngineering='Digital Hub builds in-house solutions (Data & AI, IoT, robotics) (FACT). Team size: ' + UNK,
        developerProductivity=UNK,
        digitalTransformation='€120m EIB loan for R&D+I and digitalisation (FACT).',
        applicationModernization=UNK,
        legacyEnvironment=UNK,
        data='ACCIONA Energía CDO / Head of Data & AI (FACT).',
        cybersecurity=UNK,
    ),
}

chains = {
    'mapfre': [
        dict(customerStrategy='Standardise the insurance core (REEF) across 11 more countries in 3 years', businessProblem='Finite engineering team must migrate, configure and test country by country', potentialCognitionValue='Agents execute repetitive migration/test tasks → faster time-to-country', category='SALES HYPOTHESIS'),
        dict(customerStrategy='Retire legacy cores (AS/400) where skills are scarce', businessProblem='Undocumented legacy code slows modernisation', potentialCognitionValue='Automated legacy documentation and migration support', category='SALES HYPOTHESIS'),
    ],
    'caixabank': [
        dict(customerStrategy='Deliver >€5bn technology plan with an internal engineering force', businessProblem='Hiring 2,000 engineers is slower than the plan demands', potentialCognitionValue='Capacity multiplier per squad without proportional hiring', category='SALES HYPOTHESIS'),
        dict(customerStrategy='Cognitive platform based on AI agents', businessProblem='Agents in business processes but not yet in the software delivery process', potentialCognitionValue='Extend agentic strategy to engineering', category='SALES HYPOTHESIS'),
    ],
    'bankinter': [
        dict(customerStrategy="'IA First' — maximise return on AI", businessProblem='Project demand exceeds technology delivery capacity', potentialCognitionValue='More IA First projects shipped per quarter', category='SALES HYPOTHESIS'),
    ],
    'amadeus': [
        dict(customerStrategy='Complete cloud migration and empower developers', businessProblem='Remaining estate is the hardest to migrate; Copilot helps individuals not end-to-end tasks', potentialCognitionValue='Autonomous refactoring/migration tasks at scale', category='SALES HYPOTHESIS'),
        dict(customerStrategy='GenAI test generation', businessProblem='Test maintenance burden across 10,000 engineers', potentialCognitionValue='Autonomous test generation and maintenance', category='SALES HYPOTHESIS'),
    ],
    'acciona': [
        dict(customerStrategy='MIRAI / Digital Hub: in-house digital solutions with measurable impact', businessProblem='Small Digital Hub team vs. broad business-unit demand', potentialCognitionValue='Faster solution delivery per engineer', category='SALES HYPOTHESIS'),
    ],
}

competitive = {
    'mapfre': [
        dict(currentTechnology='MAPFRE Copilot on Azure OpenAI; GitHub ecosystem likely', potentialCompetitor='Microsoft / GitHub Copilot', evidence='Azure OpenAI use is public; GitHub Copilot deployment not confirmed', category='SOURCE-BASED INTERPRETATION', differentiation='Autonomous task completion vs. in-editor assistance; measurable throughput on REEF backlog', discoveryQuestion='Which coding assistants do REEF teams use today and how is impact measured?'),
        dict(currentTechnology='In-house AI Centre (90+ use cases)', potentialCompetitor='Build in-house agents', evidence='AI Centre and agentic architecture roles exist', category='FACT', differentiation='Time-to-value and enterprise controls vs. building an engineering agent internally', discoveryQuestion='Is the agentic architecture team building coding agents or business-process agents?'),
    ],
    'caixabank': [
        dict(currentTechnology='Internal agent framework / cognitive platform; Salesforce Agentforce (business)', potentialCompetitor='Build in-house; Microsoft/GitHub', evidence='Agent framework public; developer tooling UNKNOWN', category='SOURCE-BASED INTERPRETATION', differentiation='Purpose-built software-engineering agent complementing their platform', discoveryQuestion='What developer tooling does CaixaBank Tech standardise on?'),
    ],
    'bankinter': [
        dict(currentTechnology='Microsoft 365 Copilot organisation-wide', potentialCompetitor='Microsoft / GitHub Copilot', evidence='M365 Copilot deployment is public; GitHub Copilot UNKNOWN', category='SOURCE-BASED INTERPRETATION', differentiation='Beyond assistant productivity to end-to-end delivery of IA First projects', discoveryQuestion='How is Copilot ROI measured for engineering, and what is the next step?'),
    ],
    'amadeus': [
        dict(currentTechnology='GitHub Copilot deployed; internal LLM; GenAI test generation', potentialCompetitor='GitHub Copilot (incumbent); Cursor/Claude Code/Windsurf adoption UNKNOWN', evidence='Copilot deployment is public (CTO interviews)', category='FACT', differentiation='Autonomous agents for migration/test maintenance at 10,000-engineer scale; complement Copilot', discoveryQuestion='What has Copilot changed in cycle time, and where does it stop helping?'),
    ],
    'acciona': [
        dict(currentTechnology=UNK, potentialCompetitor='Consultancies / SIs; Microsoft/Google AI tooling', evidence='No public evidence on developer tooling', category='UNKNOWN', differentiation='TBD after discovery', discoveryQuestion='How does the Digital Hub build and maintain software today?'),
    ],
}

markets = {
    'mapfre': ['Spain', 'Brazil', 'LATAM', 'USA', 'Reinsurance (global)'],
    'caixabank': ['Spain', 'Portugal (BPI)'],
    'bankinter': ['Spain', 'Portugal', 'Ireland (Avant Money)', 'Luxembourg'],
    'amadeus': ['Global — airlines, hospitality, travel sellers'],
    'acciona': ['Spain', 'Australia', 'LATAM', 'USA', 'Europe (Nordex)'],
}

# initiative → problem chain
init_problem = {
    'mapfre-reef': ('REEF live in Spain and several LATAM countries; 11 more countries planned', 'Country rollouts require repetitive migration, configuration and regression testing by a finite team', 'Rollout slips reduce the promised >50% efficiency gain and delay strategic-plan targets'),
    'mapfre-ai-centre': ('90+ AI use cases governed by the AI Manifesto', 'Moving use cases from pilot to production needs engineering capacity the AI Centre may not own', 'AI value stays in pilots; business impact undershoots'),
    'mapfre-legacy-modernization': ('AS/400 policy admin being replaced in USA', 'Legacy knowledge concentrated in few people; documentation gaps', 'Higher migration risk and cost; longer dual-running'),
    'cabk-tech-scale': ('CaixaBank Tech growing from 1,600 towards 2,000', 'Hiring pace and onboarding limit delivery of the >€5bn plan', 'Plan milestones depend on headcount that arrives late'),
    'cabk-agents-platform': ('Agent framework and cognitive platform in build', 'Agents target business processes; software delivery itself not yet agent-assisted', 'Engineering remains the bottleneck for scaling agents'),
    'cabk-cloud': ('Hybrid/multi-cloud landing zones established', 'Application refactoring for cloud consumes scarce engineers', 'Cloud benefits delayed; cost of dual estates'),
    'bkt-ia-first': ('CEO-led IA First with CAITO; M365 Copilot deployed', 'Project demand from business exceeds technology delivery capacity', 'IA First ROI capped by engineering throughput'),
    'bkt-tech-transformation': ('CIO organisation in transition after Durán moved to CAITO', 'Leadership transition may slow technology decisions', 'Delayed roadmap; unclear sponsorship'),
    'ama-cloud': ('>50% applications migrated; remaining estate harder', 'Long-tail migration and refactoring is labour-intensive', 'Dual running costs; delayed decommissioning'),
    'ama-genai-eng': ('Copilot, internal LLM and GenAI test generation deployed', 'Assistants raise individual productivity but not end-to-end task completion', 'Diminishing returns on GenAI investment'),
    'ama-agentic': ('Six AI agents launched for customers', 'Agentic mindset applied to products, less to internal engineering', 'Missed internal efficiency'),
    'ana-mirai': ('MIRAI co-finances AI/automation projects in Infrastructure', 'Approved projects still need engineers to build them', 'Backlog of funded but undelivered projects'),
    'ana-digital-hub': ('Digital Hub builds in-house solutions', 'Small team vs. broad demand across 60+ countries', 'Slow time-to-solution; reliance on external SIs'),
    'ana-energia-ai': ('Energía Data & AI strategy under CDO', 'Data/AI products need software engineering to scale', 'AI stays in analytics, not operations'),
}

# use case enrichment: category, relevance, businessProblem, initiativeId, target stakeholders
uc_meta = {
    'mapfre-uc-1': ('Migrations', 'MEDIUM', 'mapfre-reef', ['mapfre-lacave', 'mapfre-marana', 'mapfre-escriva'], 'REEF rollout and €65m plan are FACT; engineering bottleneck is a hypothesis'),
    'mapfre-uc-2': ('Code Quality', 'LOW / EXPLORATORY', 'mapfre-legacy-modernization', ['mapfre-lacave'], 'US legacy retirement is FACT; scope elsewhere UNKNOWN'),
    'mapfre-uc-3': ('Feature Development', 'MEDIUM', 'mapfre-ai-centre', ['mapfre-marana', 'mapfre-andujar', 'mapfre-bodas'], 'Agentic architecture team exists (territory plan); appetite for engineering agents UNKNOWN'),
    'cabk-uc-1': ('Feature Development', 'MEDIUM', 'cabk-tech-scale', ['cabk-vicens', 'cabk-sanchez'], 'Hiring ramp is FACT; capacity gap is hypothesis'),
    'cabk-uc-2': ('Code Quality', 'LOW / EXPLORATORY', 'cabk-tech-scale', ['cabk-sanchez'], 'No public evidence on test bottleneck'),
    'cabk-uc-3': ('Migrations', 'LOW / EXPLORATORY', 'cabk-cloud', ['cabk-sanchez'], 'Cloud programme is FACT; refactoring load UNKNOWN'),
    'bkt-uc-1': ('Feature Development', 'MEDIUM', 'bkt-ia-first', ['bkt-duran', 'bkt-cio-unknown'], 'IA First and Copilot are FACT; delivery bottleneck hypothesis'),
    'bkt-uc-2': ('Automations', 'LOW / EXPLORATORY', 'bkt-tech-transformation', ['bkt-cio-unknown'], 'Regulatory load is generic banking FACT; Bankinter specifics UNKNOWN'),
    'bkt-uc-3': ('Feature Development', 'LOW / EXPLORATORY', 'bkt-tech-transformation', ['bkt-villanueva'], 'EVO Banco is FACT; engineering model UNKNOWN'),
    'ama-uc-1': ('Migrations', 'HIGH', 'ama-cloud', ['ama-roy', 'ama-mendez'], 'Cloud migration is the largest IT programme (FACT, CTO)'),
    'ama-uc-2': ('Code Quality', 'HIGH', 'ama-genai-eng', ['ama-roy'], 'GenAI test generation already a stated priority (FACT)'),
    'ama-uc-3': ('Advanced workflows', 'MEDIUM', 'ama-genai-eng', ['ama-roy'], 'Copilot deployed; agent platform appetite UNKNOWN'),
    'ana-uc-1': ('Feature Development', 'MEDIUM', 'ana-digital-hub', ['ana-carballo', 'ana-rivero'], 'MIRAI/Digital Hub are FACT; delivery constraint hypothesis'),
    'ana-uc-2': ('Code Quality', 'LOW / EXPLORATORY', 'ana-digital-hub', ['ana-rivero'], 'No public evidence'),
    'ana-uc-3': ('Data & Analytics', 'LOW / EXPLORATORY', 'ana-energia-ai', ['ana-serrano'], 'Data & AI strategy FACT; engineering need UNKNOWN'),
}

for acc in accounts:
    acc['technology'] = tech[acc['id']]
    acc['cognitionRelevanceChain'] = chains[acc['id']]
    acc['competitiveIntel'] = competitive[acc['id']]
    acc['keyMarkets'] = markets[acc['id']]
    for i in acc['initiatives']:
        s, p, imp = init_problem[i['id']]
        i['currentSituation'] = s
        i['potentialProblem'] = p + ' — ' + HYP
        i['potentialImplication'] = imp + ' — ' + HYP
        i['problemCategory'] = 'SALES HYPOTHESIS'
    for u in acc['useCases']:
        cat, rel, init, targets, ev = uc_meta[u['id']]
        u.update(category=cat, relevance=rel, initiativeId=init, targetStakeholderIds=targets, evidenceSummary=ev,
                 businessProblem=init_problem[init][1] + ' — ' + HYP)

# ---------------------------------------------------------------- stakeholders
role_map = {'Economic Buyer': 'Economic Buyer', 'Champion': 'Champion', 'Influencer': 'Influencer', 'Technical evaluator': 'Technical Evaluator', 'Blocker': 'Blocker', 'Unknown': 'Unknown'}
level_map = {
    'mapfre-huertas': 'Board / CEO', 'mapfre-escriva': 'Executive Committee', 'mapfre-delicado': 'Senior Leadership', 'mapfre-bernal': 'Director',
    'cabk-gortazar': 'Board / CEO', 'cabk-vicens': 'Executive Committee', 'cabk-sanchez': 'Director', 'cabk-corominas': 'Senior Leadership',
    'bkt-ortiz': 'Board / CEO', 'bkt-duran': 'Senior Leadership', 'bkt-villanueva': 'Senior Leadership', 'bkt-cio-unknown': 'Senior Leadership',
    'ama-roy': 'Executive Committee', 'ama-mendez': 'Senior Leadership', 'ama-krips': 'Senior Leadership',
    'ana-rivero': 'Senior Leadership', 'ana-carballo': 'Senior Leadership', 'ana-serrano': 'Director',
}
for s in stakeholders:
    s['powerRole'] = role_map.get(s['buyingRole'], 'Unknown')
    s['roleIsHypothesis'] = s['powerRole'] != 'Unknown'
    s['level'] = level_map.get(s['id'], 'Unknown')
    s['businessUnit'] = s['functionArea']
    s['influence'] = 'High' if s['level'] in ('Board / CEO', 'Executive Committee') else 'Unknown'
    s['championPotential'] = 'Unknown'
    s['dataOrigin'] = 'PUBLIC RESEARCH'
    s['lastUpdated'] = TODAY
    s['recommendedNextAction'] = 'Validate role and priorities via warm introduction — ' + HYP
    s['useCaseIds'] = [u['id'] for a in accounts if a['id'] == s['accountId'] for u in a['useCases'] if s['id'] in u['targetStakeholderIds']]

# MAPFRE territory plan (user brief, pending the pptx itself)
TP = 'MAPFRE Territory Plan (map mapfre.pptx) — as summarised in user brief'
def tp(id_, name, title, role, rel, level, fn, hyp=False):
    return dict(id=id_, accountId='mapfre', name=name, title=title, functionArea=fn, responsibilities=UNK, strategicPriorities=UNK,
                technologyPriorities=UNK, relevantInitiatives=[], publicStatements=[], recentActivity=UNK, potentialPain=UNK + ' — validate against REEF / agentic architecture agenda',
                cognitionRelevance=UNK, relationshipStatus=rel, buyingRole=role, sources=[dict(claim=f'{name} — {title}; role in plan: {role}', source=TP, date='2026-09', category='FACT', confidence='High')],
                powerRole=role, roleIsHypothesis=hyp, level=level, businessUnit=fn, influence='Unknown', championPotential='High' if 'Champion' in role or role == 'Coach' else 'Unknown',
                dataOrigin='TERRITORY PLAN', lastUpdated=TODAY, recommendedNextAction='Confirm details against the uploaded territory plan', useCaseIds=[])

new_mapfre = [
    tp('mapfre-wiznez', 'Santiago Wiznez', 'CTTO', 'Economic Buyer', 'Identified', 'Executive Committee', 'Technology'),
    tp('mapfre-ledesma', 'José Antonio Ledesma', 'CISO', 'Security', 'Identified', 'Senior Leadership', 'Security'),
    tp('mapfre-solanas', 'Maribel Solanas', 'CDO', 'Influencer', 'Identified', 'Senior Leadership', 'Data', hyp=True),
    tp('mapfre-jimenez', 'Leire Jiménez', 'Chief Innovation Officer', 'Influencer', 'Identified', 'Senior Leadership', 'Innovation', hyp=True),
    tp('mapfre-lacave', 'Íñigo Lacave', 'Technology & Architecture Director', 'Coach', 'Engaged', 'Director', 'Technology & Architecture'),
    tp('mapfre-javanovic', 'Mat Javanovic', 'Global Cloud Director', 'Technical Evaluator', 'Identified', 'Director', 'Global Cloud', hyp=True),
    tp('mapfre-marana', 'Javier Maraña', 'Head of Agentic Architecture & Technological Innovation', 'Champion', 'Champion', 'Director', 'Agentic Architecture & Technological Innovation'),
    tp('mapfre-andujar', 'Gabriel Andújar', 'Agent Architecture Manager', 'Technical Champion', 'Champion', 'Manager', 'Agent Architecture'),
    tp('mapfre-bodas', 'Diego José Bodas', 'AI Center Director', 'Influencer', 'Identified', 'Director', 'AI / Data leadership', hyp=True),
]
for s in new_mapfre:
    s['useCaseIds'] = [u['id'] for u in A['mapfre']['useCases'] if s['id'] in u['targetStakeholderIds']]
for rt, boss in [('mapfre-marana', 'mapfre-lacave'), ('mapfre-andujar', 'mapfre-marana'), ('mapfre-javanovic', 'mapfre-lacave')]:
    pass  # reporting lines are NOT in the brief → do not invent

S = {s['id']: s for s in stakeholders}
# Territory plan: Escrivá = Global CIO; Wiznez = EB. Existing public-research EB designation for Escrivá is overridden by the plan.
S['mapfre-escriva']['title'] = 'Global CIO (Territory Plan) · Group Chief Technology and Data Officer per MAPFRE 2026 announcement (PUBLIC RESEARCH)'
S['mapfre-escriva']['buyingRole'] = 'Influencer'; S['mapfre-escriva']['powerRole'] = 'Influencer'; S['mapfre-escriva']['roleIsHypothesis'] = True
S['mapfre-escriva']['relationshipStatus'] = 'Identified'; S['mapfre-escriva']['dataOrigin'] = 'TERRITORY PLAN'
S['mapfre-escriva']['sources'].append(dict(claim='Listed as Global CIO in the MAPFRE Territory Plan', source=TP, date='2026-09', category='FACT', confidence='High'))
S['mapfre-bernal']['title'] = 'Transformation Director (Territory Plan) · Transformation Expert Director, MAPFRE Group (PUBLIC RESEARCH)'
S['mapfre-bernal']['buyingRole'] = 'Champion'; S['mapfre-bernal']['powerRole'] = 'Champion'; S['mapfre-bernal']['roleIsHypothesis'] = False
S['mapfre-bernal']['relationshipStatus'] = 'Champion'; S['mapfre-bernal']['dataOrigin'] = 'TERRITORY PLAN'; S['mapfre-bernal']['championPotential'] = 'High'
S['mapfre-bernal']['sources'].append(dict(claim='Designated Champion in the MAPFRE Territory Plan', source=TP, date='2026-09', category='FACT', confidence='High'))
stakeholders.extend(new_mapfre)

# ---------------------------------------------------------------- opportunities
O = {o['id']: o for o in opps}
m = O['mapfre-opp-reef']
m['stakeholderIds'] = ['mapfre-wiznez', 'mapfre-escriva', 'mapfre-lacave', 'mapfre-marana', 'mapfre-andujar', 'mapfre-bernal', 'mapfre-ledesma', 'mapfre-delicado']
m['economicBuyerId'] = 'mapfre-wiznez'; m['championId'] = 'mapfre-marana'
m['meddpicc']['economicBuyer'] = 'Santiago Wiznez (CTTO) — EB per Territory Plan. Budget authority for REEF-related tooling: VALIDATION REQUIRED.'
m['meddpicc']['champion'] = 'Javier Maraña (Champion) and Gabriel Andújar (Technical Champion) per Territory Plan; José Luis Bernal (Champion, Transformation); Íñigo Lacave (Coach).'
m['nextAction'] = 'Working session with Javier Maraña / Gabriel Andújar: map REEF rollout backlog to agent-executable tasks; ask Íñigo Lacave (Coach) how Wiznez evaluates tooling.'
for o in opps:
    for k in o['threeWhys']['validation'].values():
        k.setdefault('source', 'Public research / no customer conversation yet')
        k.setdefault('lastUpdated', TODAY)

save('accounts.json', accounts); save('stakeholders.json', stakeholders); save('opportunities.json', opps)
print('enriched', len(stakeholders), 'stakeholders')
