import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StatusBar,
  ActivityIndicator,
  StyleSheet,
  Animated,
  Keyboard,
  AccessibilityInfo,
  Platform
} from 'react-native';
import CustomTextInput from '../components/CustomTextInput';

const AnimatedTouchableOpacity = Animated.createAnimatedComponent(TouchableOpacity);
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS } from '../constants/theme';
import { searchCustomers, getShopProfile, getAppMeta, setAppMeta } from '../db/database';
import { exportKhataBackup } from '../services/exportService';
import { useResponsive, TEXT_PROPS } from '../utils/responsive';
import { formatINR } from '../utils/formatUtils';
import ScreenContainer from '../components/ScreenContainer';
import { getLicenseStatus, formatLicenseDate } from '../utils/licenseReminders';
import { rescheduleAllLicenseReminders } from '../services/licenseNotifications';
import { LEGAL_TEXT_VERSION } from '../constants/legalText';
import FirstLaunchNoticeModal from '../components/FirstLaunchNoticeModal';
import { shouldShowBackupReminder } from '../utils/backupReminder';

export default function HomeScreen({ navigation }) {
  const [query, setQuery] = useState('');
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [licenseAlerts, setLicenseAlerts] = useState({ shop: null, pharmacist: null });
  const [showFirstLaunchNotice, setShowFirstLaunchNotice] = useState(false);
  const [showBackupReminder, setShowBackupReminder] = useState(false);

  const r = useResponsive();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(r, insets), [r, insets]);

  const reqCounter = useRef(0);
  const timerRef = useRef(null);
  const queryRef = useRef(query);
  queryRef.current = query;

  // FAB animation values & state
  const entranceAnim = useRef(new Animated.Value(0)).current;
  const pressAnim = useRef(new Animated.Value(1)).current;
  const scrollAnim = useRef(new Animated.Value(1)).current;
  const [isPressed, setIsPressed] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const scrollY = useRef(0);
  const scrollTimeout = useRef(null);
  const isCollapsed = useRef(false);

  useEffect(() => {
    let isMounted = true;
    if (AccessibilityInfo && AccessibilityInfo.isReduceMotionEnabled) {
      AccessibilityInfo.isReduceMotionEnabled()
        .then((enabled) => {
          if (isMounted && enabled) {
            setReduceMotion(true);
            entranceAnim.setValue(1);
            pressAnim.setValue(1);
            scrollAnim.setValue(1);
          }
        })
        .catch(() => {});
    }

    const sub = AccessibilityInfo?.addEventListener?.('reduceMotionChanged', (enabled) => {
      if (isMounted) {
        setReduceMotion(!!enabled);
        if (enabled) {
          entranceAnim.setValue(1);
          pressAnim.setValue(1);
          scrollAnim.setValue(1);
        }
      }
    });

    return () => {
      isMounted = false;
      if (sub?.remove) sub.remove();
    };
  }, [entranceAnim, pressAnim, scrollAnim]);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSub = Keyboard.addListener(showEvent, () => setKeyboardVisible(true));
    const hideSub = Keyboard.addListener(hideEvent, () => setKeyboardVisible(false));

    return () => {
      showSub.remove();
      hideSub.remove();
      if (scrollTimeout.current) clearTimeout(scrollTimeout.current);
    };
  }, []);

  const checkLicenseAlerts = useCallback(() => {
    try {
      const sp = getShopProfile();
      if (!sp) {
        setLicenseAlerts({ shop: null, pharmacist: null });
        return;
      }
      const shopStatus = getLicenseStatus(sp.shop_license_validity);
      const pharmStatus = getLicenseStatus(sp.pharmacist_license_validity);

      setLicenseAlerts({
        shop:
          shopStatus.state === 'expired' || shopStatus.state === 'expiring'
            ? {
                status: shopStatus,
                dateFormatted: formatLicenseDate(sp.shop_license_validity),
              }
            : null,
        pharmacist:
          pharmStatus.state === 'expired' || pharmStatus.state === 'expiring'
            ? {
                status: pharmStatus,
                dateFormatted: formatLicenseDate(sp.pharmacist_license_validity),
              }
            : null,
      });

      rescheduleAllLicenseReminders(sp).catch(() => {});
    } catch (e) {
      console.warn('Error checking license alerts:', e);
    }
  }, []);

  const checkLegalAndBackupNotices = useCallback(() => {
    try {
      // 1. First-launch notice check
      const acceptedVersion = getAppMeta('legal_terms_accepted_version');
      if (acceptedVersion !== LEGAL_TEXT_VERSION) {
        setShowFirstLaunchNotice(true);
      } else {
        setShowFirstLaunchNotice(false);
      }

      // 2. 14-day backup reminder check
      const lastExportedAt = getAppMeta('last_backup_exported_at');
      const dismissedAt = getAppMeta('backup_reminder_dismissed_at');
      const needsReminder = shouldShowBackupReminder(lastExportedAt, dismissedAt);
      setShowBackupReminder(needsReminder);
    } catch (e) {
      console.warn('Error checking legal/backup notices:', e);
    }
  }, []);

  const handleAcceptFirstLaunchNotice = () => {
    try {
      setAppMeta('legal_terms_accepted_version', LEGAL_TEXT_VERSION);
      setAppMeta('legal_terms_accepted_at', new Date().toISOString());
      setShowFirstLaunchNotice(false);
    } catch (e) {
      setShowFirstLaunchNotice(false);
    }
  };

  const handleDismissBackupReminder = () => {
    try {
      setAppMeta('backup_reminder_dismissed_at', new Date().toISOString());
      setShowBackupReminder(false);
    } catch (e) {
      setShowBackupReminder(false);
    }
  };

  const handleExportBackupFromBanner = async () => {
    try {
      const res = await exportKhataBackup();
      if (res && res.success) {
        setShowBackupReminder(false);
      }
    } catch (e) {
      console.warn('Error exporting from banner:', e);
    }
  };

  const loadData = useCallback((skipDebounce = false) => {
    const q = queryRef.current;
    const currentReq = ++reqCounter.current;
    
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    // Fire immediately if query is cleared or skipDebounce is true
    if (q === '' || skipDebounce) {
      try {
        const results = searchCustomers(q);
        if (reqCounter.current === currentReq) {
          setCustomers(results);
          setLoading(false);
        }
      } catch (e) {
        console.error('Error loading customers:', e);
        if (reqCounter.current === currentReq) setLoading(false);
      }
      return;
    }

    setLoading(true);
    
    timerRef.current = setTimeout(() => {
      try {
        const results = searchCustomers(q);
        if (reqCounter.current === currentReq) {
          setCustomers(results);
          setLoading(false);
        }
      } catch (e) {
        console.error('Error loading customers:', e);
        if (reqCounter.current === currentReq) setLoading(false);
      }
    }, 250);
  }, []);

  // 1. Triggered exclusively by query changing (typing)
  useEffect(() => {
    loadData(false);
    return () => {
      reqCounter.current++;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [query, loadData]);

  // 2. Triggered on focus
  useFocusEffect(
    useCallback(() => {
      loadData(true);
      checkLicenseAlerts();
      checkLegalAndBackupNotices();

      let popAnimation = null;
      if (reduceMotion) {
        entranceAnim.setValue(1);
      } else {
        entranceAnim.setValue(0);
        popAnimation = Animated.sequence([
          Animated.delay(150),
          Animated.spring(entranceAnim, {
            toValue: 1,
            friction: 6,
            tension: 120,
            useNativeDriver: Platform.OS !== 'web',
          }),
        ]);
        popAnimation.start();
      }

      return () => {
        reqCounter.current++;
        if (timerRef.current) clearTimeout(timerRef.current);
        if (popAnimation) popAnimation.stop();
      };
    }, [loadData, checkLicenseAlerts, checkLegalAndBackupNotices, reduceMotion, entranceAnim]) 
  );

  const handlePressIn = useCallback(() => {
    setIsPressed(true);
    if (!reduceMotion) {
      Animated.timing(pressAnim, {
        toValue: 0.92,
        duration: 80,
        useNativeDriver: Platform.OS !== 'web',
      }).start();
    }
  }, [reduceMotion, pressAnim]);

  const handlePressOut = useCallback(() => {
    setIsPressed(false);
    if (!reduceMotion) {
      Animated.spring(pressAnim, {
        toValue: 1,
        friction: 5,
        tension: 150,
        useNativeDriver: Platform.OS !== 'web',
      }).start();
    }
  }, [reduceMotion, pressAnim]);

  const handleScroll = useCallback((event) => {
    if (reduceMotion) return;
    const currentY = event.nativeEvent?.contentOffset?.y ?? 0;
    const diff = currentY - scrollY.current;
    scrollY.current = currentY;

    if (scrollTimeout.current) {
      clearTimeout(scrollTimeout.current);
    }

    if (diff > 8 && currentY > 20) {
      if (!isCollapsed.current) {
        isCollapsed.current = true;
        Animated.timing(scrollAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: Platform.OS !== 'web',
        }).start();
      }
    } else if (diff < -8 || currentY <= 10) {
      if (isCollapsed.current) {
        isCollapsed.current = false;
        Animated.timing(scrollAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: Platform.OS !== 'web',
        }).start();
      }
    }

    scrollTimeout.current = setTimeout(() => {
      if (isCollapsed.current) {
        isCollapsed.current = false;
        Animated.timing(scrollAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: Platform.OS !== 'web',
        }).start();
      }
    }, 250);
  }, [reduceMotion, scrollAnim]);

  const handleScrollEnd = useCallback(() => {
    if (reduceMotion) return;
    if (scrollTimeout.current) {
      clearTimeout(scrollTimeout.current);
    }
    if (isCollapsed.current) {
      isCollapsed.current = false;
      Animated.timing(scrollAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: Platform.OS !== 'web',
      }).start();
    }
  }, [reduceMotion, scrollAnim]);

  const entranceScale = entranceAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.6, 1],
  });

  const entranceOpacity = entranceAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  const totalScale = Animated.multiply(entranceScale, pressAnim);

  const labelOpacity = scrollAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  const renderCustomerItem = ({ item }) => {
    const totalDue = parseFloat(item.total_due || 0);
    const hasDue = totalDue > 0;
    const hasCredit = totalDue < 0;

    return (
      <TouchableOpacity
        activeOpacity={0.7}
        style={styles.customerCard}
        onPress={() => navigation.navigate('CustomerProfile', { customerId: item.customer_id })}
      >
        <View style={styles.cardHeader}>
          <Text {...TEXT_PROPS} style={styles.customerName} numberOfLines={1}>{item.name}</Text>
          <View style={[
            styles.dueBadge,
            hasDue ? styles.dueBadgeAlert : hasCredit ? styles.dueBadgeCredit : styles.dueBadgeClear
          ]}>
            <Text {...TEXT_PROPS} style={[
              styles.dueBadgeText,
              hasDue ? styles.dueBadgeTextAlert : hasCredit ? styles.dueBadgeTextCredit : styles.dueBadgeTextClear
            ]}>
              {hasDue ? `${formatINR(totalDue)} due` : hasCredit ? `${formatINR(Math.abs(totalDue))} credit` : 'All clear'}
            </Text>
          </View>
        </View>

        <View style={styles.cardDetails}>
          <Text {...TEXT_PROPS} style={styles.detailText} numberOfLines={1}>
            <Ionicons name="call-outline" size={r.scale(13)} color={COLORS.textSecondary} /> {item.phone_number}
          </Text>
          {item.village ? (
            <Text {...TEXT_PROPS} style={styles.detailText} numberOfLines={1}>
              <Ionicons name="location-outline" size={r.scale(13)} color={COLORS.textSecondary} /> {item.village}
            </Text>
          ) : null}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <ScreenContainer>
      <FirstLaunchNoticeModal
        visible={showFirstLaunchNotice}
        onAccept={handleAcceptFirstLaunchNotice}
      />

      {/* Notebook Header */}
      <View style={styles.header}>
        <View style={{ flex: 1, marginRight: r.moderate(8) }}>
          <Text {...TEXT_PROPS} style={styles.appTitle}>MedTrack</Text>
          <Text {...TEXT_PROPS} style={styles.appSubtitle} numberOfLines={1}>
            Medical Khata Book
          </Text>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: r.scale(8) }}>
          <TouchableOpacity
            style={styles.exportButton}
            onPress={() => navigation.navigate('Profile')}
            accessibilityLabel="Shop & Pharmacist Profile"
            testID="btn-profile"
          >
            <Ionicons name="person-circle-outline" size={r.scale(22)} color={COLORS.primary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.exportButton}
            onPress={() => navigation.navigate('Settings')}
            accessibilityLabel="Settings"
            testID="btn-settings"
          >
            <Ionicons name="settings-outline" size={r.scale(20)} color={COLORS.primary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* License Expiry Reminders */}
      {(licenseAlerts.shop || licenseAlerts.pharmacist) && (
        <View style={styles.licenseBannersContainer}>
          {licenseAlerts.shop && (
            <View
              style={[
                styles.licenseBannerCard,
                licenseAlerts.shop.status.state === 'expired' || licenseAlerts.shop.status.isExpiringToday
                  ? styles.licenseBannerExpired
                  : styles.licenseBannerAmber,
              ]}
              testID="banner-license-shop"
            >
              <Ionicons
                name={
                  licenseAlerts.shop.status.state === 'expired' || licenseAlerts.shop.status.isExpiringToday
                    ? 'alert-circle'
                    : 'warning-outline'
                }
                size={r.scale(20)}
                color={
                  licenseAlerts.shop.status.state === 'expired' || licenseAlerts.shop.status.isExpiringToday
                    ? '#C62828'
                    : '#A15C07'
                }
                style={{ marginRight: r.scale(8) }}
              />
              <View style={{ flex: 1, marginRight: r.scale(8) }}>
                <Text
                  {...TEXT_PROPS}
                  style={[
                    styles.licenseBannerText,
                    licenseAlerts.shop.status.state === 'expired' || licenseAlerts.shop.status.isExpiringToday
                      ? styles.licenseBannerExpiredText
                      : styles.licenseBannerAmberText,
                  ]}
                  numberOfLines={2}
                >
                  {licenseAlerts.shop.status.state === 'expired'
                    ? `Drug License expired on ${licenseAlerts.shop.dateFormatted}`
                    : licenseAlerts.shop.status.isExpiringToday
                    ? `Drug License expires today (${licenseAlerts.shop.dateFormatted})`
                    : `Drug License expires in ${licenseAlerts.shop.status.daysLeft} ${licenseAlerts.shop.status.daysLeft === 1 ? 'day' : 'days'} (${licenseAlerts.shop.dateFormatted})`}
                </Text>
              </View>
              <TouchableOpacity
                style={[
                  styles.licenseBannerBtn,
                  licenseAlerts.shop.status.state === 'expired' || licenseAlerts.shop.status.isExpiringToday
                    ? styles.licenseBannerExpiredBtn
                    : styles.licenseBannerAmberBtn,
                ]}
                onPress={() => navigation.navigate('Profile')}
                testID="btn-banner-shop-update"
                activeOpacity={0.8}
              >
                <Text {...TEXT_PROPS} style={styles.licenseBannerBtnText}>Update</Text>
              </TouchableOpacity>
            </View>
          )}

          {licenseAlerts.pharmacist && (
            <View
              style={[
                styles.licenseBannerCard,
                licenseAlerts.pharmacist.status.state === 'expired' || licenseAlerts.pharmacist.status.isExpiringToday
                  ? styles.licenseBannerExpired
                  : styles.licenseBannerAmber,
              ]}
              testID="banner-license-pharmacist"
            >
              <Ionicons
                name={
                  licenseAlerts.pharmacist.status.state === 'expired' || licenseAlerts.pharmacist.status.isExpiringToday
                    ? 'alert-circle'
                    : 'warning-outline'
                }
                size={r.scale(20)}
                color={
                  licenseAlerts.pharmacist.status.state === 'expired' || licenseAlerts.pharmacist.status.isExpiringToday
                    ? '#C62828'
                    : '#A15C07'
                }
                style={{ marginRight: r.scale(8) }}
              />
              <View style={{ flex: 1, marginRight: r.scale(8) }}>
                <Text
                  {...TEXT_PROPS}
                  style={[
                    styles.licenseBannerText,
                    licenseAlerts.pharmacist.status.state === 'expired' || licenseAlerts.pharmacist.status.isExpiringToday
                      ? styles.licenseBannerExpiredText
                      : styles.licenseBannerAmberText,
                  ]}
                  numberOfLines={2}
                >
                  {licenseAlerts.pharmacist.status.state === 'expired'
                    ? `Pharmacist Reg. expired on ${licenseAlerts.pharmacist.dateFormatted}`
                    : licenseAlerts.pharmacist.status.isExpiringToday
                    ? `Pharmacist Reg. expires today (${licenseAlerts.pharmacist.dateFormatted})`
                    : `Pharmacist Reg. expires in ${licenseAlerts.pharmacist.status.daysLeft} ${licenseAlerts.pharmacist.status.daysLeft === 1 ? 'day' : 'days'} (${licenseAlerts.pharmacist.dateFormatted})`}
                </Text>
              </View>
              <TouchableOpacity
                style={[
                  styles.licenseBannerBtn,
                  licenseAlerts.pharmacist.status.state === 'expired' || licenseAlerts.pharmacist.status.isExpiringToday
                    ? styles.licenseBannerExpiredBtn
                    : styles.licenseBannerAmberBtn,
                ]}
                onPress={() => navigation.navigate('Profile')}
                testID="btn-banner-pharmacist-update"
                activeOpacity={0.8}
              >
                <Text {...TEXT_PROPS} style={styles.licenseBannerBtnText}>Update</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}

      {/* 14-day Backup Reminder Banner */}
      {showBackupReminder && (
        <View style={styles.backupReminderContainer}>
          <View style={styles.backupReminderCard} testID="banner-backup-reminder">
            <Ionicons
              name="cloud-upload-outline"
              size={r.scale(20)}
              color="#1E40AF"
              style={{ marginRight: r.scale(8) }}
            />
            <View style={{ flex: 1, marginRight: r.scale(8) }}>
              <Text {...TEXT_PROPS} style={styles.backupReminderText}>
                Your data is only on this phone. Export a backup.
              </Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: r.scale(6) }}>
              <TouchableOpacity
                style={styles.backupReminderExportBtn}
                onPress={handleExportBackupFromBanner}
                testID="btn-backup-now"
                activeOpacity={0.8}
              >
                <Text {...TEXT_PROPS} style={styles.backupReminderExportBtnText}>Export</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.backupReminderDismissBtn}
                onPress={handleDismissBackupReminder}
                testID="btn-dismiss-backup-reminder"
                accessibilityLabel="Dismiss backup reminder"
              >
                <Ionicons name="close" size={r.scale(18)} color="#4B5563" />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* Auto-focused Large Search Box */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={r.scale(20)} color={COLORS.textTertiary} style={styles.searchIcon} />
        <CustomTextInput
          style={styles.searchInput}
          placeholder="Search by phone, name or village..."
          placeholderTextColor={COLORS.textTertiary}
          value={query}
          onChangeText={setQuery}
          autoFocus={true}
          keyboardType="default"
          returnKeyType="search"
          clearButtonMode="while-editing"
          maxFontSizeMultiplier={1.3}
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={() => setQuery('')} style={styles.clearSearchBtn}>
            <Ionicons name="close-circle" size={r.scale(18)} color={COLORS.textTertiary} />
          </TouchableOpacity>
        )}
      </View>

      {/* Customer List or Empty Match */}
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : customers.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="book-outline" size={r.scale(48)} color={COLORS.borderStrong} />
          <Text {...TEXT_PROPS} style={styles.emptyTitle}>
            {query.trim() ? `No customer matching "${query}"` : 'No customers yet'}
          </Text>
          <Text {...TEXT_PROPS} style={styles.emptySubtitle}>
            Add this customer to start tracking medicines and purchases.
          </Text>
          <TouchableOpacity
            style={styles.addCustomerEmptyBtn}
            onPress={() => navigation.navigate('AddCustomer', { initialPhoneOrName: query.trim() })}
          >
            <Ionicons name="person-add-outline" size={r.scale(20)} color={COLORS.textInverted} />
            <Text {...TEXT_PROPS} style={styles.addCustomerEmptyBtnText}>+ Add Customer</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          testID="home-customer-list"
          data={customers}
          keyExtractor={(item) => String(item.customer_id)}
          renderItem={renderCustomerItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          onMomentumScrollEnd={handleScrollEnd}
          onScrollEndDrag={handleScrollEnd}
        />
      )}

      {/* Floating Add Customer Button */}
      {customers.length > 0 && !keyboardVisible && (
        <AnimatedTouchableOpacity
          testID="home-fab-add-customer"
          accessibilityRole="button"
          accessibilityLabel="Add customer"
          activeOpacity={0.92}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={[
            styles.fab,
            isPressed && styles.fabPressed,
            reduceMotion
              ? null
              : {
                  opacity: entranceOpacity,
                  transform: [{ scale: totalScale }],
                },
          ]}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          onPress={() => navigation.navigate('AddCustomer', { initialPhoneOrName: query.trim() })}
        >
          <Ionicons name="person-add" size={r.scale(20)} color={COLORS.textInverted} />
          <Animated.View
            style={
              reduceMotion
                ? null
                : {
                    opacity: labelOpacity,
                    transform: [
                      {
                        scale: scrollAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [0.01, 1],
                          extrapolate: 'clamp',
                        }),
                      },
                    ],
                  }
            }
          >
            <Text {...TEXT_PROPS} style={styles.fabText}>+ Add Customer</Text>
          </Animated.View>
        </AnimatedTouchableOpacity>
      )}
    </ScreenContainer>
  );
}

const makeStyles = (r, insets) => StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: r.moderate(20),
    paddingTop: r.moderate(12),
    paddingBottom: r.moderate(8),
  },
  appTitle: {
    fontSize: r.font(22),
    fontWeight: '700',
    color: COLORS.primary,
    letterSpacing: -0.3,
  },
  appSubtitle: {
    fontSize: r.font(12),
    color: COLORS.textSecondary,
    marginTop: r.scale(2),
  },
  exportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primaryLight,
    paddingHorizontal: r.moderate(12),
    paddingVertical: r.moderate(7),
    borderRadius: r.moderate(999),
    borderWidth: 1,
    borderColor: COLORS.primaryBorder,
    gap: r.scale(4),
    minHeight: r.touch,
  },
  exportButtonText: {
    fontSize: r.font(12),
    fontWeight: '600',
    color: COLORS.primary,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    marginHorizontal: r.moderate(20),
    marginVertical: r.moderate(12),
    paddingHorizontal: r.moderate(12),
    height: r.scale(52),
    borderRadius: r.moderate(14),
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  searchIcon: {
    marginRight: r.moderate(8),
  },
  searchInput: {
    flex: 1,
    fontSize: r.font(15),
    color: COLORS.textPrimary,
    height: '100%',
  },
  clearSearchBtn: {
    padding: r.moderate(4),
    minHeight: Math.max(r.touch, r.scale(44)),
    justifyContent: 'center',
  },
  listContent: {
    paddingHorizontal: r.moderate(20),
    paddingBottom: insets.bottom + Math.max(r.moderate(88), 88), // fab padding: button height (56) + 32 = 88
    paddingTop: r.moderate(4),
  },
  customerCard: {
    backgroundColor: COLORS.surface,
    padding: r.moderate(16),
    borderRadius: r.moderate(10),
    marginBottom: r.moderate(12),
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 2,
    elevation: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: r.moderate(8),
  },
  customerName: {
    fontSize: r.font(18),
    fontWeight: '600',
    color: COLORS.textPrimary,
    flex: 1,
    marginRight: r.moderate(8),
  },
  dueBadge: {
    paddingHorizontal: r.moderate(12),
    paddingVertical: r.scale(3),
    borderRadius: r.moderate(999),
    borderWidth: 1,
  },
  dueBadgeAlert: {
    backgroundColor: COLORS.dueBadgeBg,
    borderColor: COLORS.dueBadgeBorder,
  },
  dueBadgeCredit: {
    backgroundColor: COLORS.creditBadgeBg,
    borderColor: COLORS.creditBadgeBorder,
  },
  dueBadgeClear: {
    backgroundColor: COLORS.clearBadgeBg,
    borderColor: COLORS.clearBadgeBorder,
  },
  dueBadgeText: {
    fontSize: r.font(12),
    fontWeight: '600',
  },
  dueBadgeTextAlert: {
    color: COLORS.dueBadgeText,
  },
  dueBadgeTextCredit: {
    color: COLORS.creditBadgeText,
  },
  dueBadgeTextClear: {
    color: COLORS.clearBadgeText,
  },
  cardDetails: {
    flexDirection: 'row',
    gap: r.moderate(16),
  },
  detailText: {
    fontSize: r.font(13),
    color: COLORS.textSecondary,
    lineHeight: r.font(20),
    flex: 1,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: r.moderate(32),
  },
  emptyTitle: {
    fontSize: r.font(18),
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginTop: r.moderate(12),
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: r.font(14),
    color: COLORS.textSecondary,
    lineHeight: r.font(20),
    textAlign: 'center',
    marginTop: r.scale(4),
    marginBottom: r.moderate(20),
  },
  addCustomerEmptyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    paddingVertical: r.moderate(12),
    paddingHorizontal: r.moderate(20),
    borderRadius: r.moderate(999),
    gap: r.scale(8),
    minHeight: r.touch,
  },
  addCustomerEmptyBtnText: {
    fontSize: r.font(15),
    fontWeight: '600',
    color: COLORS.textInverted,
  },
  fab: {
    position: 'absolute',
    bottom: insets.bottom + 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    height: 56,
    minHeight: 56,
    minWidth: 56,
    paddingVertical: r.moderate(12),
    paddingHorizontal: r.moderate(20),
    borderRadius: r.moderate(999),
    gap: r.scale(8),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 8,
    elevation: 8,
  },
  fabPressed: {
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.16,
    shadowRadius: 4,
    elevation: 3,
  },
  fabText: {
    fontSize: r.font(15),
    fontWeight: '600',
    color: COLORS.textInverted,
  },
  licenseBannersContainer: {
    paddingHorizontal: r.moderate(20),
    paddingTop: r.scale(2),
    paddingBottom: r.scale(4),
    gap: r.scale(8),
  },
  licenseBannerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: r.moderate(10),
    paddingHorizontal: r.moderate(12),
    paddingVertical: r.moderate(8),
    borderWidth: 1,
  },
  licenseBannerAmber: {
    backgroundColor: '#FEF3C7',
    borderColor: '#FCD34D',
  },
  licenseBannerExpired: {
    backgroundColor: '#FEE2E2',
    borderColor: '#FCA5A5',
  },
  licenseBannerText: {
    fontSize: r.font(12.5),
    fontWeight: '600',
    lineHeight: r.font(16),
  },
  licenseBannerAmberText: {
    color: '#92400E',
  },
  licenseBannerExpiredText: {
    color: '#991B1B',
  },
  licenseBannerBtn: {
    paddingHorizontal: r.moderate(10),
    paddingVertical: r.moderate(5),
    borderRadius: r.moderate(6),
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: r.touch,
  },
  licenseBannerAmberBtn: {
    backgroundColor: '#D97706',
  },
  licenseBannerExpiredBtn: {
    backgroundColor: '#DC2626',
  },
  licenseBannerBtnText: {
    color: '#FFFFFF',
    fontSize: r.font(12),
    fontWeight: '700',
  },
  backupReminderContainer: {
    paddingHorizontal: r.moderate(20),
    paddingTop: r.scale(2),
    paddingBottom: r.scale(4),
  },
  backupReminderCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: r.moderate(10),
    paddingHorizontal: r.moderate(12),
    paddingVertical: r.moderate(8),
  },
  backupReminderText: {
    fontSize: r.font(12.5),
    fontWeight: '600',
    color: '#1E3A8A',
    lineHeight: r.font(16),
  },
  backupReminderExportBtn: {
    backgroundColor: '#2563EB',
    paddingHorizontal: r.moderate(10),
    paddingVertical: r.moderate(5),
    borderRadius: r.moderate(6),
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: r.touch,
  },
  backupReminderExportBtnText: {
    color: '#FFFFFF',
    fontSize: r.font(12),
    fontWeight: '700',
  },
  backupReminderDismissBtn: {
    padding: r.moderate(4),
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: r.touch,
  },
});
