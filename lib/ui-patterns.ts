// ─────────────────────────────────────────────────────────────────────────────
// UI PATTERN LIBRARY — the "inspiration" for Make it real.
//
// A hand-curated set of proven mobile UI patterns, written as DESCRIPTIONS
// (structure + the details that make them feel finished). Never copied pages,
// code or brand assets: patterns, not products.
//
// For each screen, pickPatterns() scores every pattern by keyword hits in the
// screen name (worth most), the wireframe's labels and the product idea, and
// returns the best few; app/api/design adds them to each screen prompt
// (patternsPrompt).
// To add a pattern: append to PATTERNS. Self-check: lib/ui-patterns.check.ts
//
// ponytail: keyword matching. Swap for embedding search if it picks badly.
// ─────────────────────────────────────────────────────────────────────────────

export type UiPattern = {
  name: string;
  keywords: string[]; // lowercase words/stems that suggest this pattern
  layout: string; // top-to-bottom structure
  details: string; // the polish that makes it feel real
};

export const PATTERNS: UiPattern[] = [
  {
    name: "Welcome / onboarding",
    keywords: ["welcome", "onboard", "intro", "get started", "splash", "landing"],
    layout: "Large hero illustration or gradient art filling the top half; short bold headline (2 lines max); one supporting sentence; page dots; full-width primary button; quiet secondary text link below.",
    details: "Generous top whitespace, headline in display size, the only colourful element is the art + primary button.",
  },
  {
    name: "Sign in / sign up",
    keywords: ["sign in", "sign up", "login", "log in", "register", "account", "password", "create account"],
    layout: "Small logo mark; title + one-line subtitle; stacked labelled fields (email, password with show toggle); full-width primary button; divider 'or'; social sign-in buttons; footer link to switch sign in/up.",
    details: "Fields 48px tall with clear labels above, forgot-password link right-aligned under the password, inline helper text in muted.",
  },
  {
    name: "Home feed with greeting",
    keywords: ["home", "feed", "dashboard", "greeting", "good morning", "good evening", "hi "],
    layout: "Greeting line + name with avatar on the right; search field; horizontal chips or category row; a highlighted hero card; section title + 'See all' link; vertical list or 2-column cards; bottom tab bar.",
    details: "Section titles in title size with consistent spacing above; one hero card with depth (shadow-2); everything else flat on surface.",
  },
  {
    name: "Search with filters",
    keywords: ["search", "find", "filter", "explore", "discover", "browse", "results"],
    layout: "Search field with icon + filter button; row of filter chips (one selected); result count; result list of rows with thumbnail, title, meta line and a trailing price or rating.",
    details: "Selected chip filled with primary, others outlined; recent searches as removable chips when empty.",
  },
  {
    name: "Category grid",
    keywords: ["categor", "grid", "collections", "departments", "pizza", "sushi", "genres", "topics"],
    layout: "Section title; 2- or 3-column grid of tiles, each with an image or illustrated icon, label underneath, optional count.",
    details: "Equal tile heights, rounded corners (radius-lg), soft tinted backgrounds per tile from the palette, labels one line with ellipsis.",
  },
  {
    name: "Item list with rich rows",
    keywords: ["list", "popular", "nearby", "restaurants", "items", "near you", "recent", "top"],
    layout: "Rows: square thumbnail left, title + 1-line meta (category · distance · time) in the middle, rating or price right; thin dividers or card gaps.",
    details: "Rating as star icon + number; meta in muted caption; a small badge (e.g. 'Free delivery', 'New') on some rows.",
  },
  {
    name: "Product / item detail",
    keywords: ["detail", "product", "item", "dish", "menu item", "listing", "property", "course"],
    layout: "Full-bleed image (40% of screen) with back + favourite buttons floating on it; title + price row; rating + reviews count; short description; option chips (size, extras); quantity stepper; sticky bottom bar with total + primary 'Add' button.",
    details: "Content sheet overlaps the image with a large top radius; sticky bar has shadow-2 and safe bottom padding.",
  },
  {
    name: "Cart",
    keywords: ["cart", "basket", "bag", "order summary", "your order"],
    layout: "Title with item count; line items (thumbnail, name, options in muted, price, - qty + stepper); promo code field; summary card (subtotal, fees, discount, bold total); sticky full-width checkout button.",
    details: "Totals right-aligned with tabular numbers; the total row larger and bolder; a delete swipe hint or trash icon per row.",
  },
  {
    name: "Checkout / payment",
    keywords: ["checkout", "payment", "pay", "billing", "card", "address", "delivery address", "place order"],
    layout: "Step indicator; delivery address card with change link; delivery time options as selectable cards; payment method list with radio selection (card brand icon + masked number); order total; primary 'Place order' button.",
    details: "Selected option has primary border + check; secure-payment note with a lock icon in muted caption.",
  },
  {
    name: "Order / delivery tracking",
    keywords: ["track", "tracking", "status", "on the way", "delivery", "eta", "courier", "shipment"],
    layout: "Map or illustration area at top; large ETA ('12 min'); vertical progress steps (placed, preparing, on the way, delivered) with the current one highlighted; courier card with avatar, name, call/message buttons.",
    details: "Completed steps filled, current pulsing-style ring (static), future steps muted; ETA in display size.",
  },
  {
    name: "Profile",
    keywords: ["profile", "me", "my account", "user", "avatar", "personal"],
    layout: "Large avatar centered (or left) with name, handle/email and an edit button; stats row (3 numbers with labels); grouped menu list (icon, label, chevron) in rounded cards; sign out at the bottom in muted/destructive style.",
    details: "Stats use title size numbers; menu groups separated by section labels in caption caps.",
  },
  {
    name: "Settings",
    keywords: ["settings", "preferences", "notifications settings", "privacy", "security", "options"],
    layout: "Grouped inset lists: section header, rows with icon + label + trailing control (toggle, value + chevron); footer version text.",
    details: "Toggles in primary when on; rows 52px; destructive row ('Delete account') in its own group at the bottom.",
  },
  {
    name: "Chat / messages",
    keywords: ["chat", "message", "inbox", "conversation", "dm", "support"],
    layout: "Header with avatar, name and online dot; message bubbles (mine right in primary, theirs left on surface) with timestamps grouped by day; composer bar at the bottom with attach icon, text field and send button.",
    details: "Bubble radius large except the corner near the tail; read receipts as tiny double check in caption.",
  },
  {
    name: "Notifications / activity",
    keywords: ["notification", "activity", "alerts", "updates", "news"],
    layout: "Segmented control (All / Mentions); grouped by Today / Earlier; rows with icon or avatar, bold actor + action text, time in muted, unread dot.",
    details: "Unread rows on a faint tinted background; actions (Accept / View) as small buttons on some rows.",
  },
  {
    name: "Booking / calendar",
    keywords: ["book", "booking", "schedule", "calendar", "appointment", "reserve", "date", "time slot", "walk"],
    layout: "Month header with arrows; horizontal week strip of date pills (selected filled); available time slots as a 3-column grid of chips; selected provider card; sticky confirm button with summary.",
    details: "Disabled slots muted with strike or low opacity; today's date marked with a dot.",
  },
  {
    name: "Map / nearby",
    keywords: ["map", "nearby", "location", "near", "around", "find a", "walker", "store locator"],
    layout: "Map area filling top 60% (drawn with soft shapes, streets as light lines, pins in primary); search pill floating on top; bottom sheet with drag handle listing nearby results as horizontal cards.",
    details: "Selected pin larger with a label; bottom sheet top radius-lg with shadow-2.",
  },
  {
    name: "Stats / analytics dashboard",
    keywords: ["stats", "analytics", "dashboard", "progress", "report", "insights", "overview", "metrics"],
    layout: "Period switcher (Day/Week/Month); headline metric in display size with trend chip (+12%); bar or line chart drawn with SVG; 2x2 grid of KPI cards; recent items list.",
    details: "Charts in primary with a lighter tint for comparison; axis labels in caption muted; trend chip green/red tint.",
  },
  {
    name: "Wallet / finance home",
    keywords: ["wallet", "balance", "bank", "finance", "money", "budget", "account balance", "spend"],
    layout: "Balance card (gradient using primary/accent) with total, masked account and quick actions row (Send, Request, Top up, More) as round icon buttons; recent transactions list.",
    details: "Amounts with tabular numbers; incoming in success colour tint, outgoing in text colour; merchant initials avatars.",
  },
  {
    name: "Transactions / history",
    keywords: ["transactions", "history", "orders", "past orders", "receipts", "payments"],
    layout: "Filter chips; list grouped by date headers; rows with merchant icon, name, category, amount right-aligned; summary of the month at top.",
    details: "Sticky date headers; amounts right-aligned and tabular; status pill for pending items.",
  },
  {
    name: "Fitness / activity tracker",
    keywords: ["fitness", "workout", "steps", "activity", "health", "exercise", "calories", "run", "tracker"],
    layout: "Greeting + date; concentric progress rings (SVG) for 2-3 goals with legend; today's stats 3-column row; workout cards with duration and intensity; start-workout primary button.",
    details: "Rings use primary, accent and a third palette colour; big numbers, small units in muted.",
  },
  {
    name: "Media player",
    keywords: ["player", "music", "podcast", "audio", "playing", "song", "episode", "video"],
    layout: "Large square artwork; title + artist; scrubber with times; transport controls (prev, big play/pause circle, next); secondary row (shuffle, repeat, queue, share).",
    details: "Play button is the single primary element; background softly tinted from the artwork colours.",
  },
  {
    name: "Article / recipe reader",
    keywords: ["article", "recipe", "read", "story", "blog", "guide", "post detail", "instructions"],
    layout: "Hero image; category tag; title in display; author row with avatar, date, read time; body text with comfortable line height; ingredients/steps as numbered list; related cards at the end.",
    details: "Reading width with generous side margins; body at lh-body; pull quote or tip card in accent tint.",
  },
  {
    name: "Social feed",
    keywords: ["social", "post", "posts", "community", "friends", "timeline", "share", "likes"],
    layout: "Stories row of circular avatars; post cards: author row (avatar, name, time, more), media, action row (like, comment, share, save), likes count, caption with bold author name, comments link.",
    details: "Media full card width with radius; action icons 24px outlined; liked state filled primary.",
  },
  {
    name: "Create / compose form",
    keywords: ["create", "new", "add", "compose", "form", "edit", "post", "upload", "write"],
    layout: "Header with cancel and title; media upload tile with dashed border; labelled fields and selects; toggles for options; sticky primary 'Publish/Save' button.",
    details: "Required fields marked subtly; character counter in caption; disabled primary until valid (lower opacity).",
  },
  {
    name: "Task list / to-do",
    keywords: ["task", "todo", "to-do", "checklist", "projects", "board", "tickets"],
    layout: "Date header + progress bar ('4 of 7 done'); filter tabs; task rows with round checkbox, title, due chip, priority dot; floating add button bottom-right.",
    details: "Done tasks struck through and muted; overdue chip in a warning tint.",
  },
  {
    name: "Reviews / ratings",
    keywords: ["review", "reviews", "rating", "ratings", "feedback", "testimonials"],
    layout: "Big average score with stars and count; distribution bars for 5→1 stars; sort chips; review cards (avatar, name, stars, date, text, helpful button).",
    details: "Distribution bars in primary on a border-tint track; long reviews truncated with 'Read more'.",
  },
  {
    name: "Subscription / paywall",
    keywords: ["subscription", "premium", "go pro", "upgrade", "plan", "pricing", "paywall", "membership"],
    layout: "Hero icon or art; headline; benefit list with check icons; plan cards side by side or stacked (monthly / yearly with 'Save 30%' badge, one selected); primary continue button; restore + terms links in caption.",
    details: "Selected plan with primary border and tinted background; price large, period small and muted.",
  },
  {
    name: "Success / confirmation",
    keywords: ["success", "confirm", "confirmed", "done", "thank", "complete", "all set", "booked"],
    layout: "Centered illustration or large check in a soft circle; headline; one-line summary; detail card with key facts (order number, time, total); primary button to continue + secondary text link.",
    details: "Lots of whitespace; the check uses accent or a success tint; summary facts as label/value rows.",
  },
  {
    name: "Empty state",
    keywords: ["empty", "no results", "nothing", "no items", "get started", "first"],
    layout: "Centered simple illustration; friendly title; one helpful sentence; one primary action.",
    details: "Illustration in palette tints only; never a blank screen.",
  },
];

// A keyword matches at the START of a word ("categor" → "categories"), and
// short ones (3 letters or fewer, like "me") only as a whole word, so "me"
// doesn't match inside "home".
// (Keywords are plain lowercase words, spaces and hyphens: no escaping needed.)
function wordMatch(k: string) {
  return new RegExp(`(^|[^a-z])${k}${k.length <= 3 ? "(?![a-z])" : ""}`);
}

/** The best few patterns for one screen (most relevant first). */
export function pickPatterns(screenName: string, labels: string[], idea = "", max = 3): UiPattern[] {
  const name = ` ${screenName.toLowerCase()} `;
  const body = ` ${labels.join(" ").toLowerCase()} `;
  const about = ` ${idea.toLowerCase()} `;
  return PATTERNS.map((p) => ({
    p,
    score: p.keywords.reduce((s, k) => {
      const hit = wordMatch(k);
      return s + (hit.test(name) ? 5 : 0) + (hit.test(body) ? 2 : 0) + (hit.test(about) ? 1 : 0);
    }, 0),
  }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    // Keep only strong matches: at least half as good as the best one.
    .filter((x, _, all) => x.score * 2 >= all[0].score)
    .slice(0, max)
    .map((x) => x.p);
}

/** The picked patterns as a prompt section ("" when none fit). */
export function patternsPrompt(screenName: string, labels: string[], idea = "") {
  const picks = pickPatterns(screenName, labels, idea);
  if (!picks.length) return "";
  const lines = picks.map((p) => `- ${p.name}: ${p.layout} Polish: ${p.details}`);
  return `Proven patterns for this kind of screen (inspiration for structure and polish; the wireframe's parts, order and labels still win):\n<inspiration>\n${lines.join("\n")}\n</inspiration>`;
}
