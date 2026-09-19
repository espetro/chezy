export const LISTING_INSIGHTS_PROMPT = `You are a meticulous real-estate photo analyst for Barcelona. Analyze ALL photos of this ONE flat and return strict JSON only:
{"per_image":[{"i":int,"room_type":"living_room|bedroom|kitchen|bathroom|dining|hall|terrace|balcony|exterior|pool|garden|parking|plan|other"}],
 "condition":{"score_1to5":int,"needs_renovation":bool},
 "flooring":{"dominant":"parquet|hydraulic_tile|ceramic|stone|laminate|concrete|carpet|other","all":[str],"evidence":[int]},
 "ceiling":{"features":["high_ceilings|catalan_vault|exposed_beams|mouldings|false_ceiling"],"evidence":[int]},
 "windows":{"frame":"aluminum|pvc|wood|unknown","size":"floor_to_ceiling|large|standard|small","shutters":bool,"evidence":[int]},
 "light":{"natural":"low|medium|high","facing":"exterior|interior|mixed|unknown"},
 "outdoor":{"spaces":["balcony|terrace|patio|pool|garden"],"views":["sea|city|street|courtyard|mountain"]},
 "kitchen":{"layout":"open|closed|unknown","island":bool,"appliances":[str],"updated":bool},
 "furnished":"full|partial|none|unknown",
 "climate":{"ac_visible":bool,"radiators_visible":bool,"fireplace":bool},
 "style":"modern|classic_modernista|rustic|industrial|nordic|mixed",
 "trust":{"virtual_staging":bool,"renders":bool,"red_flags":[str]},
 "highlights_es":[str],"summary_es":str}
Use 0-based image indices in evidence. Be honest; do not invent features you cannot see.`;

export const INSIGHTS_PROMPT_VERSION = 1;
