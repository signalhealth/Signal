import React from "react";
import { StyleSheet } from "react-native";
import Markdown from "react-native-markdown-display";
import { ThemeColors } from "../context/ThemeContext";

interface Props {
  children: string;
  theme: ThemeColors;
  fontSize?: number;
}

export function MarkdownResult({ children, theme, fontSize = 14 }: Props) {
  const styles = {
    body: {
      color: theme.textSecondary,
      fontSize,
      lineHeight: fontSize * 1.6,
    },
    heading1: {
      color: theme.text,
      fontSize: fontSize + 2,
      fontWeight: "700" as const,
      marginBottom: 6,
      marginTop: 12,
    },
    heading2: {
      color: theme.text,
      fontSize: fontSize + 1,
      fontWeight: "700" as const,
      marginBottom: 4,
      marginTop: 10,
    },
    heading3: {
      color: theme.textSecondary,
      fontSize,
      fontWeight: "700" as const,
      marginBottom: 4,
      marginTop: 8,
    },
    strong: {
      color: theme.text,
      fontWeight: "700" as const,
    },
    em: {
      color: theme.textSecondary,
      fontStyle: "italic" as const,
    },
    bullet_list: {
      marginTop: 4,
      marginBottom: 4,
    },
    ordered_list: {
      marginTop: 4,
      marginBottom: 4,
    },
    list_item: {
      marginBottom: 4,
      flexDirection: "row" as const,
    },
    bullet_list_icon: {
      color: theme.accent,
      marginRight: 6,
      lineHeight: fontSize * 1.6,
    },
    ordered_list_icon: {
      color: theme.accent,
      marginRight: 6,
      lineHeight: fontSize * 1.6,
    },
    code_inline: {
      backgroundColor: theme.cardAlt,
      color: theme.accentBright,
      fontSize: fontSize - 1,
      borderRadius: 3,
      paddingHorizontal: 4,
    },
    fence: {
      backgroundColor: theme.cardAlt,
      borderRadius: 6,
      padding: 10,
      marginVertical: 6,
    },
    paragraph: {
      marginBottom: 8,
      marginTop: 0,
    },
    hr: {
      backgroundColor: theme.sectionBorder,
      height: 1,
      marginVertical: 10,
    },
  };

  return <Markdown style={styles}>{children}</Markdown>;
}
