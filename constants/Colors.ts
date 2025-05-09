/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

const brandPurple = '#5f2ee5';
const lightText = '#11181C';
const darkText = '#ECEDEE';
const lightBackground = '#FFFFFF';
const darkBackground = '#151718';
const lightIcon = '#687076';
const darkIcon = '#9BA1A6';

export const Colors = {
    light: {
        text: lightText,
        background: lightBackground,
        tint: brandPurple,
        icon: lightIcon,
        tabIconDefault: lightIcon,
        tabIconSelected: brandPurple,
    },
    dark: {
        text: darkText,
        background: darkBackground,
        tint: brandPurple,
        icon: darkIcon,
        tabIconDefault: darkIcon,
        tabIconSelected: brandPurple,
    },
};
