import type { CommunicationView, CustomerDetailSection } from "./types";

export type CustomerSectionHelpAction = {
  label: string;
  effect: string;
};

export type CustomerSectionHelp = {
  title: string;
  purpose: string;
  steps: string[];
  actions: CustomerSectionHelpAction[];
  caution?: string;
};

const sectionHelp: Record<Exclude<CustomerDetailSection, "communication">, CustomerSectionHelp> = {
  overview: {
    title: "Check the customer information",
    purpose:
      "Use this page to check the company name, contact details, address, and permissions.",
    steps: [
      "Check that the company and contact details are correct.",
      "Edit only the information that needs to change. Example: a new phone number or billing email.",
      "Put work notes in the Journal. Example: Customer asked us to call again on Friday.",
    ],
    actions: [
      {
        label: "Open customer journal",
        effect: "Shows all notes and past work for this customer. It does not change anything.",
      },
      {
        label: "Edit customer details / Save customer details",
        effect: "Lets you change customer information. Save when finished. You must write why you made the change.",
      },
      {
        label: "Anonymize customer",
        effect: "Removes personal information, such as names and contact details. Payment and work history are kept.",
      },
      {
        label: "Delete customer",
        effect: "Permanently removes a draft or duplicate customer. You must confirm and give a reason first.",
      },
    ],
    caution:
      "Anonymizing or deleting cannot be easily undone. Check that you have the correct customer first.",
  },
  onboarding: {
    title: "Create the offer and send the setup link",
    purpose:
      "Use this page to choose what the customer will buy and send one secure link for setup and payment.",
    steps: [
      "Choose the package and number of screens. Example: 1 Standard FHD screen.",
      "Check the first payment and monthly price. Add an approved discount or free administrative charge if needed.",
      "Send the setup link. The customer then enters their details, accepts the terms, uploads material, and pays.",
    ],
    actions: [
      {
        label: "Add screen package / Remove",
        effect: "Adds or removes a screen from the offer shown here. Nothing is sent to the customer yet.",
      },
      {
        label: "Review and send secure setup link",
        effect: "Shows a final check first. After you confirm, it saves the offer and emails the setup link to the customer.",
      },
      {
        label: "Review and resend secure setup link",
        effect: "Cancels the old link and emails a new link that works for 14 days. Check the email address first.",
      },
      {
        label: "More account and payment actions",
        effect: "Shows extra actions, such as pausing billing or starting layout work. Clicking an action opens a review first.",
      },
    ],
    caution:
      "Some actions can change payments in Stripe or stop the customer's service. The change happens only after the final confirmation.",
  },
  orders: {
    title: "Check payments and subscriptions",
    purpose:
      "Use this page to check if the customer paid and to manage their subscription, discounts, cancellations, and refunds.",
    steps: [
      "Read the payment status and the suggested next step.",
      "Make sure you understand what the customer asked for. Example: Pause billing for two months.",
      "Choose the action, read what will happen, write the reason, and confirm.",
    ],
    actions: [
      {
        label: "Review recommended action",
        effect: "Opens the correct action for you to check. It does not change a payment yet.",
      },
      {
        label: "Payment changes requested by customer",
        effect: "Shows the actions you can use now. Example: pause, resume, cancel, or add a temporary discount.",
      },
      {
        label: "Confirm operation",
        effect: "Makes the change in Screenia and, when needed, in Stripe. The reason is saved in the customer history.",
      },
      {
        label: "Payment details and history",
        effect: "Shows payment references and history.",
      },
    ],
    caution:
      "Pauses, cancellations, refunds, and discounts can change future bills or stop the service. Check the request and amount first.",
  },
  devices: {
    title: "Set up the customer's screen and hardware",
    purpose:
      "Use this page after payment to create a display and give the customer a physical device from stock.",
    steps: [
      "Check that the customer paid for an available screen.",
      "Choose the correct device and enter where it will be used. Example: Reception screen.",
      "Write why this device was chosen, allocate it, and check the new display.",
    ],
    actions: [
      {
        label: "Create customer display",
        effect: "Opens a form for a new display. The display is created only after you finish and save that form.",
      },
      {
        label: "Open Hardware stock",
        effect: "Opens the full stock list. It does not give any device to the customer.",
      },
      {
        label: "Allocate to this customer",
        effect: "Gives the selected device to this customer, updates stock, and saves your reason in the customer history.",
      },
      {
        label: "Manage / Preview",
        effect: "Manage opens the display settings. Preview shows what appears on the screen in a new tab.",
      },
    ],
    caution:
      "Check the model and serial number on the physical device before giving it to the customer.",
  },
  history: {
    title: "Keep all customer notes in one place",
    purpose:
      "Use the Journal for questions, problems, decisions, and follow-ups. This helps the next admin understand what happened.",
    steps: [
      "Search the Journal first to see earlier notes.",
      "Choose a category and write a clear note. Example: Screen was offline. Restarted device. Check again tomorrow.",
      "Save the note and check that it appears at the top.",
    ],
    actions: [
      {
        label: "Save journal entry",
        effect: "Adds a new note to the customer history. Older notes are not changed or removed.",
      },
      {
        label: "Search journal",
        effect: "Finds matching notes. Example: search for offline, refund, or reception. It does not change anything.",
      },
      {
        label: "Payment and activity history",
        effect: "Shows the customer's payment and activity history.",
      },
    ],
  },
};

const communicationHelp: Record<CommunicationView, CustomerSectionHelp> = {
  messages: {
    title: "Read and answer customer messages",
    purpose:
      "Use the inbox to answer the customer and keep private work notes for the admin team.",
    steps: [
      "Read the full message and open any attached files.",
      "Write a simple reply. Example: Please restart the device and tell us if the screen comes back online.",
      "Update the status and add a private note about what the admin team should do next.",
    ],
    actions: [
      {
        label: "Support inbox / Material review",
        effect: "Switches between customer messages and uploaded files. It does not change anything.",
      },
      {
        label: "Send reply",
        effect: "Shows the reply in the customer portal, emails it to the customer, and saves a record of it.",
      },
      {
        label: "Save message update",
        effect: "Saves the status and private admin note. The private note is not emailed to the customer.",
      },
      {
        label: "Attachment name",
        effect: "Opens the attached file so you can check it. It does not approve the file.",
      },
    ],
  },
  uploads: {
    title: "Check files before using them on a screen",
    purpose:
      "Use this page to check logos, images, videos, menus, and other files from the customer.",
    steps: [
      "Open every file. Check that it belongs to this customer and looks good enough to use.",
      "Update the status and add a note. Example: Logo is too small. Ask for a larger file.",
      "When the design is ready, check the preview link and send it to the customer.",
    ],
    actions: [
      {
        label: "Support inbox / Material review",
        effect: "Switches between customer messages and uploaded files. It does not change anything.",
      },
      {
        label: "Open file",
        effect: "Opens the uploaded file so you can check it. It does not approve or publish the file.",
      },
      {
        label: "Save material update",
        effect: "Saves the file status and a private note for the admin team.",
      },
      {
        label: "Publish preview / Update preview",
        effect: "Saves the view-only link and emails it to the customer. The customer must have paid and have active service.",
      },
    ],
    caution:
      "Open the preview first. Make sure it is view-only and shows files for the correct customer.",
  },
};

export function getCustomerSectionHelp(
  section: CustomerDetailSection,
  communicationView: CommunicationView,
): CustomerSectionHelp {
  return section === "communication"
    ? communicationHelp[communicationView]
    : sectionHelp[section];
}
