# Pass prepared props to Theme Slots

Core pages prepare typed presentation props containing Publication-Safe content, translated labels, stable URLs, and available actions, then pass them to the resolved Theme Slot. Theme components may change their DOM and composition substantially, but cannot query content collections, sort or filter reviews, construct routes, read private runtime configuration, or implement SEO and RSS; this makes the presentation API explicit while keeping functional behavior shared.
