# arCus bänkpapper 

## Om sidan 

Webbplatsen är en startsida för arCus bänkpapper, som säljer bänkpapper för professionella behandlingar. Sidan riktar sig främst till företag och yrkespersoner som använder bänkpapper i exempelvis salonger, kliniker och andra behandlingsverksamheter. Tanken är att denna med tiden ska växa och fler sidor, och knappar och länkar som leder vidare till andra sidor (till exempel sök, varukorg och beställning) är därför än så länge platshållare. 

## Skiss 

Skissen finns bifogad i projektet i mappen: `skiss/assignment-skiss.png` 

Den färdiga sidan följer till stor del min ursprungliga skiss, men jag har valt att ta bort och flytta vissa delar under utvecklingen. När jag jämförde skissen med den färdiga sidan i DevTools upplevde jag att vissa delar tog för mycket plats eller gjorde sidan mindre luftig än jag hade tänkt från början. Jag valde därför att förenkla vissa sektioner, ta bort vissa element och ändra placeringen av vissa element för att få en tydligare och mer harmonisk layout. 

### Mobilversionen 

I sektionen ”Därför väljer kunder arCus?” valde jag att placera innehållet vertikalt under varandra i mobilversionen. Jag valde detta eftersom det blev tydligare och mer lättläst på den mindre skärmen, istället för att försöka få flera delar att ligga bredvid varandra. 

I footern har jag länkarna i en rad istället för tre kolumner. Företaget har bara en kanal i sociala medier, så jag har bara tagit med den. 

### Desktopversionen 

På desktop valde jag istället att låta ”Vi kör hem till dig” och ”Om arCus” få varsitt eget block. Eftersom det finns mer utrymme på en större skärm kunde jag använda ytan bättre genom att dela upp innehållet, vilket också gjorde sektionen tydligare visuellt. 

Jag valde även att ta bort knappen beställ i headern då jag ansåg den överflödig. Tanken är att man via produkter ska kunna beställa senare. 

 

Storkundsrabatten valde jag att ändra upplägget på och ha text och knapp till vänster och sedan göra cirklar med de 2 erbjudandena till höger istället då det gjorde själva erbjudandet tydligare. 

Här i footern valde jag att endast ha kvar de ordinarie länkarna och inte 3 sektioner med information då jag ansåg att det räckte gott och väl så. 

 

## Funktionalitet 

På mobil kan besökaren klicka på hamburgerknappen och då få en utfälld meny som placeras under headern. Denna togglar vid tryck på hamburgerknappen och vid klick på en länk körs funktionen `closeMenu` och stänger menyn. Funktionerna är även kopplade så att de stödjer skärmläsare genom att växla `aria-expanded` vid de olika klicken. 

All JavaScript ligger i `script.js`. JS växlar klassen och `aria-expanded`. Hur menyn ser ut när den är öppen bestäms av CSS i `style.css`. 

 

## AI-användning 

**Exempel 1:** 

**Vad bad jag om?**

Jag gav AI bilder som skulle användas på startsidan och bad den redigera dem storleksmässigt, ta bort sådant som inte skulle vara med och skapa en gemensam bakgrund som passade bättre ihop med sidans design. 

**Vad fick jag?**

Jag fick flera olika resultat som inte stämde helt överens med det jag hade tänkt mig. Jag fick därför göra flera nya försök och förtydliga vad jag ville ändra. Till slut fick jag fram bilder som jag ansåg fungerade bra för sidan. 

**Vad gjorde jag med det?**

Jag kontrollerade att varumärken och övrigt innehåll i bilderna stämde och att det inte fanns felstavningar eller andra fel. Därefter döpte jag om filerna på ett sätt som passade projektets namngivning och lade in dem i projektet. 

 

 

**Exempel 2:**

**Vad bad jag om?**

Jag bad AI om hjälp att hitta färger som skulle passa till min sida. Jag bifogade logotypen och förklarade vilken typ av webbplats jag skulle skapa. 

**Vad fick jag?**

AI rekommenderade tre färger och förklarade även att jag kunde lägga färgerna i en `:root` i CSS och använda variablerna på de olika ställena där färgerna behövdes. Den förklarade också att detta gör det enklare att återanvända färgerna och ändra dem på ett och samma ställe om jag senare vill justera färgschemat. 

**Vad gjorde jag med det?**

Jag läste igenom förklaringen av `:root` och CSS-variablerna för att förstå vad de faktiskt gjorde och såg fördelen med att använda dem. Jag valde därför att behålla lösningen med `:root`, men ändrade färgerna något och lade till en egen färg eftersom jag upplevde att några av de rekommenderade färgerna var för skarpa och gjorde sidan mindre harmonisk. 

 

## Tekniska val (VG) 

Jag valde att skapa sidan mobile-first eftersom det är så jag gillar att arbeta, först sätta de enklaste grundreglerna och sedan bygga på för större skärmar. Det gjorde att jag kunde fokusera på det viktigaste innehållet först och sedan anpassa layouten när skärmstorleken ökade. 

Jag har valt att hålla mig till kebab-case i HTML och filnamn och camelCase i JavaScript. Anledningen är att jag vill ha en konsekvent namngivning i projektet och samtidigt följa de konventioner vi har arbetat med. Det gör det enklare att läsa och förstå koden och minskar risken att olika delar av projektet får olika namngivning. Dessutom går det inte att använda bindestreck i JS-namn eftersom det då blir feltolkat.  

Jag har använt både Flexbox och CSS Grid, men till olika delar av sidan beroende på vad layouten behövt. Flexbox har jag framför allt använt när element behöver placeras och justeras i förhållande till varandra, medan Grid har passat bättre i sektioner där jag vill styra innehållet i kolumner och rader, till exempel på `#offer` där ordningen skiljer sig åt mot HTML. 

Jag har även valt att använda CSS-variabler för färger genom :root. På så sätt behöver jag inte skriva samma färgkod på flera olika ställen i CSS-filen. Om jag senare vill ändra en av sidans huvudfärger kan jag göra det på ett ställe istället för att leta igenom hela CSS-filen. 

Jag har försökt hålla HTML-strukturen semantisk genom att till exempel sätta en `<ul>` för rabatten som är 2 separata erbjudanden men inom samma sektion. Jag har 2 `<nav>` som jag skiljt åt genom `aria-labels` och klasser m.m. 

Jag valde att samla ändringen av menyns läge i en funktion i JS, `setMenuOpen`, som sätter både klassen och `aria-expanded`. Då kan de inte hamna i otakt, och `toggleMenu` och `closeMenu` kan återanvända den utan att samma kod upprepas. 

  

## Bedömning av AI-innehåll (VG) 

Jag bad AI om alternativ på hur jag kunde lösa sektionen ”Vi kör hem till dig”, eftersom bilden blev väldigt hög medan texten bredvid var betydligt kortare. AI gav mig två olika förslag och rekommenderade det ena alternativet, som använde `aspect-ratio`. 

Jag testade båda lösningarna och ställde sedan följdfrågor för att förstå vad de olika delarna av koden faktiskt gjorde. Efter att ha jämfört resultaten valde jag det andra alternativet, där jag använde `height: 0` tillsammans med `min-height: 100%`. Jag valde den lösningen eftersom den bättre uppnådde det jag faktiskt var ute efter: att bildens storlek skulle följa höjden på textinnehållet istället för att bilden skulle få en fast proportion som inte passade layouten. 

Jag har även ställt flera frågor till AI om olika delar av HTML och CSS under projektets gång. Jag har fått flera olika alternativ på hur problem kan lösas. Vissa förslag kunde jag direkt bedöma utifrån mina tidigare kunskaper och förstå att de inte passade det jag ville uppnå. Andra lösningar var nya för mig. När jag fick ett förslag som jag inte förstod ställde jag följdfrågor innan jag använde det, för att förstå vad de olika delarna av koden faktiskt gjorde. 

Därefter testade jag lösningarna i mitt eget projekt. Om resultatet inte blev som jag hade tänkt mig ändrade jag koden, ställde fler frågor eller testade en annan lösning. Jag använde alltså inte AI-förslag enbart för att det fungerade tekniskt, utan bedömde även om lösningen passade min design, min befintliga kod och om jag själv förstod vad koden gjorde. 