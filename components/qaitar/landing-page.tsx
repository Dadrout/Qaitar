import { ArrowUpRight, Check, FileCheck2, ScanLine, ShieldCheck } from "lucide-react";

const problemOptions = [
  "Брак или некачественный товар",
  "Товар не подошел по размеру или фасону",
  "Продавец игнорирует сообщения",
];

const capabilities = [
  { number: "01", title: "Определяет сценарий", text: "Анализирует вашу ситуацию на соответствие закону РК и защищает от потери времени и пробелов в документах." },
  { number: "02", title: "Формирует претензию", text: "Конструирует официальное досудебное обращение к продавцу с требованием возврата средств или замены." },
  { number: "03", title: "Контролирует дедлайны", text: "Напоминает о критических сроках ответа и подсказывает, когда пора переходить к следующему шагу." },
  { number: "04", title: "Ведет до победы", text: "Если претензия не сработала, помогает подготовить следующий официальный шаг и сохранить доказательства." },
];

function ProductPreview() {
  return (
    <div className="landing-preview" aria-label="Пример анализа чека в Qaitar">
      <div className="landing-receipt">
        <span>КАССОВЫЙ ЧЕК</span>
        <strong>₸ 89 990</strong>
        <i /><i /><i /><i />
        <small>Спасибо за покупку</small>
      </div>
      <div className="landing-phone">
        <div className="landing-phone-notch" />
        <div className="landing-phone-screen">
          <span className="landing-wordmark landing-phone-logo">Qaitar</span>
          <div className="landing-scan"><ScanLine aria-hidden="true" /></div>
          <span>Чек распознан</span>
          <div className="landing-progress"><i /></div>
          <strong>Готово к анализу</strong>
        </div>
      </div>
    </div>
  );
}

export function LandingPage() {
  return (
    <main className="landing-page">
      <header className="landing-header">
        <div className="landing-container landing-nav">
          <span aria-label="Qaitar — главная" className="landing-wordmark landing-logo">Qaitar</span>
          <div className="landing-nav-note">
            <span>Сервис защиты прав потребителей РК</span>
            <a href="/app" className="landing-pill">AI-юрист РК <ArrowUpRight aria-hidden="true" /></a>
          </div>
        </div>
      </header>

      <section className="landing-hero">
        <div className="landing-container">
          <div className="landing-eyebrow"><ShieldCheck aria-hidden="true" /> Защита прав потребителей на основе закона РК</div>
          <h1>Не изучай закон —<br /> сфотографируй чек и получи<br /> готовый алгоритм возврата.</h1>
          <p>Первый специализированный AI-сервис в Казахстане, который превращает фотографию чека в юридически выверенную претензию и пошаговый план возврата денег. Без юристов и сложных кодексов.</p>
          <div className="landing-actions">
            <a href="/app" className="landing-button landing-button-primary">Оформить возврат <ArrowUpRight aria-hidden="true" /></a>
            <a href="#how-it-works" className="landing-button landing-button-secondary">Как это работает <ArrowUpRight aria-hidden="true" /></a>
          </div>
        </div>
      </section>

      <section className="landing-stats">
        <div className="landing-container">
          <span className="landing-kicker">Масштаб проблемы / 2025 год</span>
          <h2>Нарушения прав потребителей в Казахстане<br /> достигли исторического максимума. Вы не<br /> должны молчать.</h2>
          <div className="landing-stats-grid">
            <div className="landing-big-stat">
              <strong>83 801</strong>
              <h3>Официальных обращений за 2025 год</h3>
              <p>Для сравнения: в 2024 году было зафиксировано 62 561 обращение. Темп роста нарушений составил рекордные 34% всего за один год.</p>
            </div>
            <div className="landing-stat-cards">
              <article><strong>42%</strong><h3>Розничная торговля</h3><p>Отказ в обмене товара, продажа дефектных изделий и скрытые условия.</p></article>
              <article><strong>21.8%</strong><h3>Электронная торговля</h3><p>Несоответствие описанию на маркетплейсах, проблемы с доставкой и возвратом.</p></article>
              <article className="landing-stat-highlight"><strong>64% всех нарушений приходится на эти две категории</strong><p>Основные причины жалоб: категорический отказ продавца в возврате денежных средств, обнаружение явного брака после покупки и несоответствие товара заявленным характеристикам.</p><small>Источник: Комитет по защите прав потребителей РК, 2025 г.</small></article>
            </div>
          </div>
        </div>
      </section>

      <section id="how-it-works" className="landing-process">
        <div className="landing-container">
          <span className="landing-kicker">Эффективный алгоритм / 3 простых шага</span>
          <h2>Как Qaitar защищает ваши права за 5 минут</h2>
          <article className="landing-step landing-step-featured">
            <div><span>Шаг 01</span><h3>Сфотографируйте чек или<br /> гарантийный талон</h3><p>Просто загрузите фото документа в систему. Нейросеть Qaitar мгновенно распознает дату покупки, юридическое название продавца, сумму сделки и категорию товара для точного применения закона.</p></div>
            <ProductPreview />
          </article>
          <div className="landing-step-grid">
            <article className="landing-step"><span>Шаг 02</span><h3>Выберите проблему</h3><p>Укажите причину обращения из готового списка: обнаружен скрытый дефект, товар не соответствует описанию или продавец затягивает сроки.</p><ul>{problemOptions.map((option) => <li key={option}><i />{option}</li>)}</ul></article>
            <article className="landing-step"><span>Шаг 03</span><h3>Получите алгоритм и готовую претензию</h3><p>Сервис сформирует досудебную претензию со всеми необходимыми ссылками на законы РК. Вы получите точный план действий: куда отправить документ, сколько дней ждать ответа и что делать, если продавец продолжит игнорировать ваши права.</p><div className="landing-result"><strong>Результат за 5 минут:</strong><span><Check /> Сгенерированная претензия в PDF-формате</span><span><Check /> Календарь контроля сроков ответа</span><span><Check /> Шаблон заявления в госорган</span></div></article>
          </div>
        </div>
      </section>

      <section className="landing-capabilities">
        <div className="landing-container">
          <span className="landing-kicker">Функционал Qaitar / информационная зона</span>
          <h2>Полный юридический цикл в одном интерфейсе</h2>
          <div className="landing-capability-grid">{capabilities.map((item) => <article key={item.number}><strong>{item.number}</strong><h3>{item.title}</h3><p>{item.text}</p></article>)}</div>
        </div>
      </section>

      <section className="landing-cta">
        <div className="landing-container">
          <FileCheck2 aria-hidden="true" />
          <span className="landing-kicker">Быстрый старт без риска</span>
          <h2>Верните свои деньги<br /> законным путем уже сегодня</h2>
          <p>Не тратьте время на споры с продавцами. Доверьте защиту своих прав искусственному интеллекту Qaitar. Начните прямо сейчас — это бесплатно.</p>
          <a href="/app" className="landing-button landing-button-primary">Запустить Qaitar AI <ArrowUpRight aria-hidden="true" /></a>
        </div>
      </section>

      <footer className="landing-footer">
        <div className="landing-container">
          <span className="landing-wordmark landing-logo landing-logo-footer">Qaitar</span>
          <span>Интеллектуальная защита потребителей в Казахстане</span>
          <p>© 2026 Qaitar AI. Информационный сервис — не замена профессиональной юридической помощи.</p>
          <div><a href="#how-it-works">Как это работает</a><a href="/app">Начать работу</a></div>
        </div>
      </footer>
    </main>
  );
}
