import React, { useEffect, useRef, useState } from 'react';
import { MessageCircle, X, Send, User, Bot, DownloadCloud, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useToast } from '@/hooks/use-toast';

const LOCALSTORAGE_KEY = 'cece-chat-messages-v1';

const leadSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  phone: z.string().min(10, 'Phone number must be at least 10 digits'),
  email: z.string().email('Please enter a valid email'),
  vehicle: z.string().optional(),
});
type LeadFormData = z.infer<typeof leadSchema>;

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'bot';
  timestamp: string; // ISO string for easier serialization
  meta?: Record<string, any>;
}

const FAQ_RESPONSES: Record<string, string> = {
  financing:
    "We offer competitive financing options with flexible terms! Apply on the financing page or speak to our finance team at (302) 409-4992.",
  hours:
    "We're open Mon-Fri 10AM-5PM, Sat 10AM-4PM, Sun closed. Call (302) 409-4992 for special appointments.",
  warranty: "Ask our service team about available warranty and extended coverage options.",
  directions:
    "We're at 123 Auto Blvd, USA 19943 (off Route 13). Call (302) 409-4992 if you need step-by-step directions.",
  trade: "Yes — we accept trade-ins. Get a quick online quote or bring the vehicle by for an appraisal.",
  test_drive: "Absolutely — tell us which vehicle you'd like and we'll book a test drive for you.",
  contact: "Great — share your contact info and our team will reach out within 24 hours.",
};

const QUICK_REPLIES = [
  'Financing',
  'Hours',
  'Warranty',
  'Directions',
  'Trade-in',
  'Test Drive',
  'Contact',
];

export default function Chatbot() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>(() => {
    try {
      const raw = localStorage.getItem(LOCALSTORAGE_KEY);
      if (raw) return JSON.parse(raw) as Message[];
    } catch (e) {
      console.warn('Failed to parse stored messages', e);
    }
    // default initial bot greeting
    return [
      {
        id: 'init-1',
        text: "Hi! I'm here to help you with questions about Savvy Dealer System. Ask me about financing, hours, warranties, or anything else!",
        sender: 'bot',
        timestamp: new Date().toISOString(),
      },
    ];
  });
  const [inputMessage, setInputMessage] = useState('');
  const [botTyping, setBotTyping] = useState(false);
  const [showLeadForm, setShowLeadForm] = useState(false);
  const [leadPendingData, setLeadPendingData] = useState<Partial<LeadFormData> | null>(null);

  const { toast } = useToast();

  const form = useForm<LeadFormData>({
    resolver: zodResolver(leadSchema),
    defaultValues: {
      name: '',
      phone: '',
      email: '',
      vehicle: '',
    },
  });

  const messagesContainerRef = useRef<HTMLDivElement | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const timersRef = useRef<number[]>([]);

  // persist messages
  useEffect(() => {
    try {
      localStorage.setItem(LOCALSTORAGE_KEY, JSON.stringify(messages));
    } catch (e) {
      console.warn('Failed to persist chat messages', e);
    }
  }, [messages]);

  // scroll to bottom whenever messages change or dialog opens
  useEffect(() => {
    // small delay to allow DOM to update
    const t = window.setTimeout(() => {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }, 80);
    timersRef.current.push(t);
    return () => {
      window.clearTimeout(t);
    };
  }, [messages, isOpen]);

  // cleanup timers on unmount
  useEffect(() => {
    return () => {
      timersRef.current.forEach((id) => window.clearTimeout(id));
      timersRef.current = [];
    };
  }, []);

  // utility: add a message and return its id
  const addMessage = (text: string, sender: 'user' | 'bot', meta?: Record<string, any>) => {
    const newMessage: Message = {
      id: String(Date.now()) + Math.random().toString(36).slice(2, 9),
      text,
      sender,
      timestamp: new Date().toISOString(),
      meta,
    };
    setMessages((prev) => [...prev, newMessage]);
    return newMessage.id;
  };

  // improved bot responder
  const generateBotResponse = (userMessage: string) => {
    const m = userMessage.toLowerCase();
    // simple keyword matching: prioritize contact first
    if (/(contact|call|speak|reach)/.test(m)) return FAQ_RESPONSES.contact;
    if (/(financ|loan|payment)/.test(m)) return FAQ_RESPONSES.financing;
    if (/(hour|open|time)/.test(m)) return FAQ_RESPONSES.hours;
    if (/(warrant|guarantee|coverage)/.test(m)) return FAQ_RESPONSES.warranty;
    if (/(direction|location|address|where)/.test(m)) return FAQ_RESPONSES.directions;
    if (/(trade|trade-in|trade in|tradein)/.test(m)) return FAQ_RESPONSES.trade;
    if (/(test drive|test-drive|testdrive|drive)/.test(m)) return FAQ_RESPONSES.test_drive;

    // if message looks like a lead form submission (simple heuristics)
    if (/\d{10,}|@/.test(m)) {
      setShowLeadForm(true);
      return FAQ_RESPONSES.contact;
    }

    // fallback
    return "Thanks for your question! For specific inquiries, I can connect you with our team. Try quick options below or type 'Contact' to leave your details.";
  };

  // central send function: user sends text
  const sendUserMessage = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    // add user message
    addMessage(trimmed, 'user');
    setInputMessage('');
    // simulate bot typing
    setBotTyping(true);

    // compute delay based on length and add a minimum
    const delay = Math.min(Math.max(trimmed.length * 25, 650), 2000);

    const t = window.setTimeout(() => {
      const response = generateBotResponse(trimmed);
      addMessage(response, 'bot');
      setBotTyping(false);

      // If the bot asked for contact, open lead form automatically
      if (response === FAQ_RESPONSES.contact) {
        // open form slightly after bot message
        const t2 = window.setTimeout(() => setShowLeadForm(true), 350);
        timersRef.current.push(t2);
      }
    }, delay);

    timersRef.current.push(t);
  };

  const handleSendClick = () => {
    if (botTyping) return; // don't allow send while bot typing
    sendUserMessage(inputMessage);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendClick();
    }
  };

  // quick reply handler
  const handleQuickReply = (label: string) => {
    // simulate clicking a prefilled question
    sendUserMessage(label);
  };

  // Lead form submit
  const handleLeadSubmit = (data: LeadFormData) => {
    // in production -> POST to backend here
    console.log('Lead submitted (demo):', data);
    toast({
      title: 'Thanks — we received your info',
      description: 'Our team will contact you within 24 hours.',
    });

    // Add a friendly bot message after form submit
    addMessage(`Thanks ${data.name}! Our team will reach out at ${data.phone} or ${data.email}.`, 'bot', {
      lead: true,
    });

    setShowLeadForm(false);
    form.reset();
    setLeadPendingData(null);
  };

  const handleSaveConversation = () => {
    try {
      const blob = new Blob([JSON.stringify(messages, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `cece-chat-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast({ title: 'Saved', description: 'Conversation downloaded.' });
    } catch (e) {
      console.error(e);
      toast({ title: 'Error', description: 'Could not save conversation.' });
    }
  };

  const handleClearConversation = () => {
    setMessages([
      {
        id: 'init-1',
        text: "Hi! I'm here to help you with questions about Savvy Dealer System. Ask me about financing, hours, warranties, or anything else!",
        sender: 'bot',
        timestamp: new Date().toISOString(),
      },
    ]);
    localStorage.removeItem(LOCALSTORAGE_KEY);
    toast({ title: 'Cleared', description: 'Conversation reset.' });
  };

  // helper: format timestamp to human short form
  const formatTime = (iso?: string) => {
    if (!iso) return '';
    const d = new Date(iso);
    return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  };

  return (
    <>
      {/* Floating Chat Button */}
      <Button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg z-50 bg-primary hover:bg-primary/90"
        size="icon"
        aria-label="Open chat"
      >
        <MessageCircle className="h-6 w-6" />
      </Button>

      {/* Chat Dialog */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-md h-[640px] p-0 gap-0">
          <DialogHeader className="p-3 border-b bg-primary text-primary-foreground">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-3">
                <span className="font-semibold">Chat with Savvy Dealer System</span>
                <span className="text-xs opacity-80">Premium</span>
              </div>

              <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon" onClick={handleSaveConversation} aria-label="Download conversation">
                  <DownloadCloud className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={handleClearConversation} aria-label="Clear conversation">
                  <Trash2 className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsOpen(false)}
                  className="text-primary-foreground hover:bg-primary-foreground/20"
                  aria-label="Close chat"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </DialogHeader>

          <div className="flex flex-col h-full bg-card">
            <ScrollArea className="flex-1 p-3">
              <div
                ref={messagesContainerRef}
                className="space-y-3 flex flex-col"
                role="log"
                aria-live="polite"
                aria-relevant="additions"
              >
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex items-start gap-3 ${
                      message.sender === 'user' ? 'flex-row-reverse' : ''
                    }`}
                    aria-label={`${message.sender === 'user' ? 'You' : 'Savvy Dealer System'} at ${formatTime(
                      message.timestamp
                    )}`}
                  >
                    <div className="flex-shrink-0">
                      {message.sender === 'bot' ? (
                        <div className="w-9 h-9 bg-primary rounded-full flex items-center justify-center">
                          <Bot className="h-4 w-4 text-primary-foreground" />
                        </div>
                      ) : (
                        <div className="w-9 h-9 bg-secondary rounded-full flex items-center justify-center">
                          <User className="h-4 w-4 text-secondary-foreground" />
                        </div>
                      )}
                    </div>

                    <div
                      className={`max-w-[80%] rounded-lg p-3 break-words text-sm ${
                        message.sender === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      <div className="whitespace-pre-wrap">{message.text}</div>
                      <div className="mt-1 text-[11px] opacity-60">{formatTime(message.timestamp)}</div>
                    </div>
                  </div>
                ))}

                {/* bot typing indicator */}
                {botTyping && (
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0">
                      <div className="w-9 h-9 bg-primary rounded-full flex items-center justify-center">
                        <Bot className="h-4 w-4 text-primary-foreground" />
                      </div>
                    </div>
                    <div className="bg-muted rounded-lg p-3">
                      <div className="flex items-center gap-1">
                        {/* animated dots */}
                        <span className="inline-flex gap-1 items-center" aria-hidden>
                          <span className="w-2 h-2 rounded-full animate-bounce inline-block" style={{ animationDelay: '0s' }} />
                          <span className="w-2 h-2 rounded-full animate-bounce inline-block" style={{ animationDelay: '0.12s' }} />
                          <span className="w-2 h-2 rounded-full animate-bounce inline-block" style={{ animationDelay: '0.24s' }} />
                        </span>
                        <span className="text-xs opacity-80">Cece is typing…</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Lead Form (inline) */}
                {showLeadForm && (
                  <div className="bg-card border rounded-lg p-4">
                    <Form {...form}>
                      <form
                        onSubmit={form.handleSubmit(handleLeadSubmit)}
                        className="space-y-3"
                        aria-label="Contact form"
                      >
                        <FormField
                          control={form.control}
                          name="name"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Name</FormLabel>
                              <FormControl>
                                <Input {...field} placeholder="Full name" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="phone"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Phone</FormLabel>
                              <FormControl>
                                <Input {...field} placeholder="(555) 555-5555" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="email"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Email</FormLabel>
                              <FormControl>
                                <Input {...field} placeholder="you@example.com" type="email" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="vehicle"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Vehicle of Interest (Optional)</FormLabel>
                              <FormControl>
                                <Input {...field} placeholder="e.g., 2020 Honda Civic" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <div className="flex gap-2">
                          <Button type="submit" className="flex-1">Submit</Button>
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => {
                              setShowLeadForm(false);
                              form.reset();
                            }}
                          >
                            Cancel
                          </Button>
                        </div>
                      </form>
                    </Form>
                  </div>
                )}

                {/* quick replies */}
                <div className="flex flex-wrap gap-2 pt-1">
                  {QUICK_REPLIES.map((q) => (
                    <Button
                      key={q}
                      size="sm"
                      variant="ghost"
                      onClick={() => handleQuickReply(q)}
                      disabled={botTyping}
                    >
                      {q}
                    </Button>
                  ))}
                </div>

                <div ref={bottomRef} />
              </div>
            </ScrollArea>

            {/* Input area */}
            <div className="border-t p-3">
              <div className="flex gap-2 items-end">
                <Textarea
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={botTyping ? 'Please wait…' : 'Type your message... (Enter to send, Shift+Enter newline)'}
                  className="flex-1 min-h-[40px] max-h-36 resize-none"
                  rows={1}
                  aria-label="Message"
                  disabled={botTyping}
                />
                <Button
                  onClick={handleSendClick}
                  disabled={botTyping || !inputMessage.trim()}
                  size="icon"
                  aria-label="Send message"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
              <div className="mt-2 text-xs opacity-70 flex items-center justify-between">
                <div>Powered by Savvy Dealer System • Secure</div>
                <div className="opacity-60">Tip: try "Financing" or "Contact"</div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
