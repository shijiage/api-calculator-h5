# Implementation Plan: Merge Recommend + Test-Cases into Discover Page

## Overview

Merge bottom tab bar entries recommend and testCases into a single discover page
with an in-page top tab switcher. Bottom tab bar: 5 tabs to 4 tabs.

## 1. Files to Change

| File | Action |
|------|--------|
| pages/discover/discover.vue | CREATE |
| components/app-tab-bar/app-tab-bar.vue | MODIFY 5->4 tabs |
| pages.json | MODIFY add discover, remove recommend+test-cases |
| pages/mine/mine.vue | MODIFY testCases navigation |
| pages/recommend/recommend.vue | KEEP on disk |
| pages/test-cases/test-cases.vue | KEEP on disk |

## 2. discover.vue Template Architecture

Fixed top-panel (glassmorphism) contains:
- paddingTop: statusBarH
- Tab switcher: recommend | testCases
- v-if recommend: search-bar + section-chips
- v-if testCases: nothing extra

v-if recommend: scroll-view (absolute, top=topPanelHeight)
v-if testCases: scroll-view (absolute, top=topPanelHeight)
app-tab-bar current=discover

## 3. discover.vue Script

Shared: activeTab, statusBarH, topPanelHeight, scheduleMeasureTopPanel
Deep-link: onLoad reads query.tab
Recommend state: sections, keyword, loading, etc (from recommend.vue)
Test-cases state: tcSections (RENAMED), activeCategory, favoriteMap (from test-cases.vue)
Watchers: activeTab->remeasure, sectionChips->remeasure, keyword->debounce
Lifecycle: onMounted->measure, onShow->fetch+favorites

## 4. Style conflicts resolved with rec-/tc- prefixes

## 5. Tab bar: remove recommend+testCases entries, add discover

## 6. mine.vue: redirectTo discover?tab=testCases (not navigateTo)

## 7. Verification: build, tabs, sub-tabs, deep-link, regression
