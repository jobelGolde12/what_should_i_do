import { describe, it, expect } from "vitest";
import {
  categorizeAction,
  cleanActionText,
  extractActionPhrase,
  dedupeActions,
} from "@/lib/actionUtils";

describe("actionUtils", () => {
  describe("categorizeAction", () => {
    it("maps payment actions", () => {
      expect(categorizeAction("Pay the invoice")).toBe("pay");
      expect(categorizeAction("Settle the balance")).toBe("pay");
    });

    it("maps submission actions", () => {
      expect(categorizeAction("Submit the application")).toBe("submit");
      expect(categorizeAction("Fill out the form")).toBe("submit");
    });

    it("maps communication actions", () => {
      expect(categorizeAction("Reply to the email")).toBe("communicate");
      expect(categorizeAction("Call the office")).toBe("communicate");
    });

    it("maps attendance actions", () => {
      expect(categorizeAction("Attend the meeting")).toBe("attend");
      expect(categorizeAction("Join the webinar")).toBe("attend");
    });

    it("maps document-related actions", () => {
      expect(categorizeAction("Prepare the documents")).toBe("document");
      expect(categorizeAction("Sign the contract")).toBe("document");
    });

    it("falls back to other", () => {
      expect(categorizeAction("Do a backflip")).toBe("other");
      expect(categorizeAction("")).toBe("other");
    });
  });

  describe("cleanActionText", () => {
    it("strips list markers and numbering", () => {
      expect(cleanActionText("- Submit report")).toBe("Submit report");
      expect(cleanActionText("• Submit report")).toBe("Submit report");
      expect(cleanActionText("3.  Pay bill")).toBe("Pay bill");
    });

    it("strips backticks and quotes", () => {
      expect(cleanActionText('`fix` the "bug"')).toBe("Fix the bug");
    });

    it("collapses whitespace and trims trailing punctuation", () => {
      expect(cleanActionText("call   them,")).toBe("Call them");
      expect(cleanActionText("send   it now.")).toBe("Send it now");
    });

    it("capitalizes the first letter", () => {
      expect(cleanActionText("respond to the notice")).toBe("Respond to the notice");
    });
  });

  describe("extractActionPhrase", () => {
    it("strips leading politeness fillers", () => {
      expect(extractActionPhrase("Please submit the final project by Friday")).toBe(
        "Submit the final project by Friday"
      );
      expect(extractActionPhrase("Kindly email the team")).toBe("Email the team");
    });

    it("strips second-person obligation phrases", () => {
      expect(extractActionPhrase("You must submit the report")).toBe("Submit the report");
      expect(extractActionPhrase("We need to pay the rent")).toBe("Pay the rent");
    });

    it("splits compound sentences at the second action verb", () => {
      expect(extractActionPhrase("Submit the report and attend the meeting")).toBe(
        "Submit the report"
      );
    });

    it("returns the capitalized sentence when no verb matches", () => {
      expect(extractActionPhrase("enjoy your weekend")).toBe("Enjoy your weekend");
    });
  });

  describe("dedupeActions", () => {
    it("removes near-duplicates while preserving first-seen order", () => {
      const out = dedupeActions([
        "Submit the final project by Friday",
        "Submit the final project by Friday!",
        "Pay the invoice",
      ]);
      expect(out).toEqual(["Submit the final project by Friday", "Pay the invoice"]);
    });

    it("normalizes markers and casing before comparing", () => {
      expect(dedupeActions(["- Submit", "• submit", "3) Submit"])).toEqual(["Submit"]);
    });

    it("drops empty entries", () => {
      expect(dedupeActions(["   ", "", "Pay the bill"])).toEqual(["Pay the bill"]);
    });
  });
});
