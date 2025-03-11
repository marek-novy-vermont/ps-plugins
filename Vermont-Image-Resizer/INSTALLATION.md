# Inštalačná príručka

## Pre vývojárov

Ak chcete pokračovať vo vývoji tohto rozšírenia, postupujte podľa týchto krokov:

1. Nainštalujte si [UXP Developer Tool (UDT)](https://developer.adobe.com/photoshop/uxp/guides/devtool/) z Creative Cloud Desktop aplikácie.

2. Spustite UXP Developer Tool.

3. Kliknite na "Add Plugin" a vyberte priečinok projektu.

4. Kliknite na "Load" pre nahratie rozšírenia do Photoshopu.

5. Pre ladenie využite možnosť "Debug" v UXP Developer Tool.

6. Pre vytvorenie inštalačného balíčka kliknite na "Package" a vytvorí sa .ccx súbor, ktorý sa dá distribuovať.

## Pre používateľov

### Metóda 1: Inštalácia cez Creative Cloud Plugin Marketplace

1. Otvorte Creative Cloud Desktop aplikáciu.
2. Prejdite do "Marketplace" > "Plugins".
3. Vyhľadajte "Vermont eShop Image Resizer".
4. Kliknite na "Install".

### Metóda 2: Manuálna inštalácia

1. Stiahnite si súbor vermont-eshop-resizer.ccx.
2. Otvorte Photoshop.
3. Prejdite do menu "Plugins" > "Manage Plugins".
4. Kliknite na "Install Plugins".
5. Vyberte stiahnutý súbor vermont-eshop-resizer.ccx.
6. Reštartujte Photoshop.

## Kompatibilita

Toto rozšírenie vyžaduje:
- Adobe Photoshop 2023 (verzia 24.0) alebo novší
- Operačný systém: Windows 10/11 alebo macOS 10.15+

## Odstraňovanie problémov

Ak máte problémy s inštaláciou:

1. Uistite sa, že máte najnovšiu verziu Photoshopu.
2. Reštartujte Photoshop a skúste znova.
3. Skontrolujte, či máte administrátorské oprávnenia na vašom počítači.
4. Vyčistite cache Photoshopu zatvorením aplikácie a odstránením súborov v priečinku:
   - Windows: %APPDATA%\Adobe\UXP\PluginsStorage
   - macOS: ~/Library/Application Support/Adobe/UXP/PluginsStorage 