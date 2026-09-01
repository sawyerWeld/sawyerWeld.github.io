# Historical price methodology

## Question

What would it have cost to buy the submitted Pauper decks on the opening day of each Paupergeddon, and which cards account for the change?

## Price rule

- Use the first tournament day as the observation date.
- Price tournament-playable paper cards in US dollars.
- Use the cheapest normal, nonfoil printing with a recorded price on that date.
- Treat ordinary basic lands as zero dollars.
- Use MTGGoldfish's daily TCGplayer Mid history as the primary long-run series.
- Report TCGplayer event-week low sold prices as a sensitivity check where available.
- Never use a printing before its release.

This is a replacement-cost estimate, not a claim about what any player actually paid. Players borrow cards, reuse collections, buy in other currencies, and choose different printings.

## Deck evidence

- **Full field:** every submitted list, or exact aggregate card distributions for every list.
- **Field reconstruction:** complete archetype counts multiplied by published representative lists.
- **Competitive sample:** published Top 8, Top 16, or Top 32 lists. This describes the event's competitive edge and is not labeled as a field average.

The page must encode these classes in every historical chart and tooltip. Older samples must not be joined to full-field estimates as though they were equivalent observations.

## Decomposition

For adjacent events, separate the change into:

1. **Card-price effect:** reprice the earlier card basket on the later date.
2. **Metagame effect:** hold later prices fixed and replace the earlier basket with the later field.
3. **New-card effect:** identify cards unavailable at the earlier event date.

Also publish a constant-basket index made only from cards available at every compared date. This is the cleanest measure of price inflation because deck composition is held fixed.

## Reproducibility

Cache raw source pages and price responses with retrieval timestamps. Generated chart data should include unresolved cards, source coverage, and the exact pricing rule. Do not silently substitute current prices for missing historical observations.
