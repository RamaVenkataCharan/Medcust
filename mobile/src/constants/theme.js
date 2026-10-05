export const COLORS = {
  // Notebook canvas
  background: '#FAF7F2',       // Warm ivory notebook page
  surface: '#FFFFFF',          // Card paper
  surfaceSubtle: '#F4EFEB',    // Slightly toned paper
  border: '#E8E2D9',           // Ruled line hairline border
  borderStrong: '#D6CDBD',     // Stronger divider

  // Ink Typography
  textPrimary: '#2D2621',      // Deep charcoal ink
  textSecondary: '#786F66',    // Muted sepia ink
  textTertiary: '#A89F95',     // Soft timestamp / placeholder ink
  textInverted: '#FFFFFF',

  // Terracotta Warm Accent
  primary: '#B9533F',          // Warm terracotta (spec #B9533F)
  primaryDark: '#A3462E',
  primaryLight: '#FDF0EC',
  primaryBorder: '#F2C8BC',

  // Avatar & Icon circle fills
  avatarBg: '#F8DDD3',         // Peach tint for person-icon circles
  greenCircleBg: '#D8EBD9',    // Light green circle for payment icon
  greenText: '#2F5D3A',        // Dark green text / icon for payments

  // Amber due banner
  amberBannerBg: '#FDEBCB',    // Warm amber banner background
  amberBannerText: '#A15C07',  // Amber bold due text

  // Grand Total peach band (AddPurchaseScreen)
  grandTotalBg: '#FBEEE8',     // Warm peach band for the Grand Total row

  // Credit / neutral banner
  creditBannerBg: '#F0F0F0',   // Neutral grey for credit balance
  creditBannerText: '#555555',

  // Due & Payment Badges (Quiet & clean)
  dueBadgeBg: '#FEF3C7',       // Warm pale amber
  dueBadgeText: '#92400E',
  dueBadgeBorder: '#FCD34D',

  clearBadgeBg: '#F3F4F6',     // Calm light slate
  clearBadgeText: '#4B5563',
  clearBadgeBorder: '#E5E7EB',

  paymentCardBg: '#F0FDF4',     // Soft mint/sage for payment received
  paymentCardBorder: '#BBF7D0',
  paymentGreen: '#15803D',

  danger: '#DC2626',
  dangerLight: '#FEF2F2',
};

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
};

export const RADIUS = {
  sm: 6,
  md: 10,
  lg: 14,
  xl: 18,
  pill: 999,
};

export const FONTS = {
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.textPrimary,
    letterSpacing: -0.3,
  },
  header: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  body: {
    fontSize: 15,
    color: COLORS.textPrimary,
    lineHeight: 22,
  },
  bodySecondary: {
    fontSize: 14,
    color: COLORS.textSecondary,
    lineHeight: 20,
  },
  subtext: {
    fontSize: 12,
    color: COLORS.textTertiary,
  },
};
