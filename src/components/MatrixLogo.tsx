// =====================================================
// MatrixLogo Component (PERFORMANCE OPTIMIZED)
// =====================================================
// Animated SVG logo with Matrix-style falling binary code
// Optimizations:
// - 30fps throttle (instead of 60/120fps)
// - Reduced particles on mobile (50%)
// - Visibility-based pause (IntersectionObserver + Page Visibility API)
// - Removed expensive drop-shadow filter
// =====================================================

import { useEffect, useRef, useId, useState, useCallback } from 'react';

interface MatrixLogoProps {
    className?: string;
}

// Detect mobile for reduced particles
const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

// Matrix rain column manager (OPTIMIZED)
class MatrixComma {
    private drops: number[];
    private speeds: number[];
    private readonly columns: number;
    private readonly fontSize: number;
    private readonly x: number;
    private readonly y: number;
    private readonly width: number;
    private readonly height: number;
    private readonly trailLength: number;

    constructor(x: number, y: number, width: number, height: number) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        // OPTIMIZATION: Reduce columns on mobile by 50%
        this.columns = isMobile ? 14 : 28;
        // OPTIMIZATION: Reduce trail length on mobile
        this.trailLength = isMobile ? 15 : 30;
        this.fontSize = 12;
        this.drops = [];
        this.speeds = [];

        for (let i = 0; i < this.columns; i++) {
            this.drops[i] = Math.random() * -50;
            this.speeds[i] = 0.5 + Math.random() * 0.8;
        }
    }

    draw(group: SVGGElement): void {
        // Clear old text elements
        while (group.firstChild) {
            group.removeChild(group.firstChild);
        }

        for (let i = 0; i < this.columns; i++) {
            const xPos = this.x + i * (this.width / this.columns);

            // Draw character trail
            for (let j = 0; j < this.trailLength; j++) {
                const yPos = this.y + (this.drops[i] - j) * this.fontSize;

                if (yPos > this.y - 100 && yPos < this.y + this.height + 100) {
                    const char = Math.random() > 0.5 ? '0' : '1';
                    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
                    text.setAttribute('x', String(xPos));
                    text.setAttribute('y', String(yPos));
                    text.setAttribute('font-family', 'Courier New, monospace');
                    text.setAttribute('font-size', String(this.fontSize));
                    text.setAttribute('font-weight', 'bold');
                    text.setAttribute('fill', '#0f0');
                    // OPTIMIZATION: Removed drop-shadow filter (GPU killer)
                    text.textContent = char;

                    // Opacity: brighter at top of trail
                    let opacity: number;
                    if (j === 0) {
                        opacity = 1;
                    } else if (j < 8) {
                        opacity = 0.95 - j * 0.08;
                    } else {
                        opacity = 0.4 - (j - 8) * 0.02;
                    }
                    opacity = Math.max(0.08, opacity);

                    text.setAttribute('opacity', String(opacity));
                    group.appendChild(text);
                }
            }

            // Increment drop with varied speeds
            this.drops[i] += this.speeds[i];

            // Reset when leaving area
            if (this.drops[i] * this.fontSize > this.height + 120) {
                this.drops[i] = Math.random() * -40;
                this.speeds[i] = 0.5 + Math.random() * 0.8;
            }
        }
    }
}

// Target frame interval for 30fps (~33ms)
const FRAME_INTERVAL = 33;

export function MatrixLogo({ className = '' }: MatrixLogoProps) {
    const uniqueId = useId();
    const containerRef = useRef<SVGSVGElement>(null);
    const comma1Ref = useRef<SVGGElement>(null);
    const comma2Ref = useRef<SVGGElement>(null);
    const comma3Ref = useRef<SVGGElement>(null);
    const wrapper1Ref = useRef<SVGGElement>(null);
    const wrapper2Ref = useRef<SVGGElement>(null);
    const wrapper3Ref = useRef<SVGGElement>(null);

    const [isHovering, setIsHovering] = useState(false);
    const [isVisible, setIsVisible] = useState(true);
    const [isPageVisible, setIsPageVisible] = useState(true);

    const rotationRef = useRef(0);
    const rotationSpeedRef = useRef(0);
    const lastTimeRef = useRef(0);
    const lastFrameTimeRef = useRef(0);

    // Unique IDs for clip paths
    const comma1ClipId = `comma1Clip-${uniqueId}`;
    const comma2ClipId = `comma2Clip-${uniqueId}`;
    const comma3ClipId = `comma3Clip-${uniqueId}`;

    // Center of triangle for rotation
    const centerX = 400;
    const centerY = 427;

    // OPTIMIZATION: Page Visibility API - pause when tab is hidden
    useEffect(() => {
        const handleVisibilityChange = () => {
            setIsPageVisible(!document.hidden);
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, []);

    // OPTIMIZATION: IntersectionObserver - pause when offscreen
    useEffect(() => {
        if (!containerRef.current) return;

        const observer = new IntersectionObserver(
            ([entry]) => {
                setIsVisible(entry.isIntersecting);
            },
            { threshold: 0.1 }
        );

        observer.observe(containerRef.current);

        return () => {
            observer.disconnect();
        };
    }, []);

    // Matrix rain animation (OPTIMIZED with 30fps throttle)
    useEffect(() => {
        if (!comma1Ref.current || !comma2Ref.current || !comma3Ref.current) return;

        // OPTIMIZATION: Don't animate if not visible or page is hidden
        if (!isVisible || !isPageVisible) return;

        const comma1 = new MatrixComma(165, 465, 130, 170);
        const comma2 = new MatrixComma(345, 185, 130, 170);
        const comma3 = new MatrixComma(525, 465, 130, 170);

        let animationId: number;

        const animate = (currentTime: number) => {
            // OPTIMIZATION: 30fps throttle
            if (currentTime - lastFrameTimeRef.current >= FRAME_INTERVAL) {
                lastFrameTimeRef.current = currentTime;

                if (comma1Ref.current) comma1.draw(comma1Ref.current);
                if (comma2Ref.current) comma2.draw(comma2Ref.current);
                if (comma3Ref.current) comma3.draw(comma3Ref.current);
            }

            animationId = requestAnimationFrame(animate);
        };

        animationId = requestAnimationFrame(animate);

        return () => {
            cancelAnimationFrame(animationId);
        };
    }, [isVisible, isPageVisible]);

    // Rotation animation
    useEffect(() => {
        const wrappers = [wrapper1Ref.current, wrapper2Ref.current, wrapper3Ref.current];
        if (!wrappers[0] || !wrappers[1] || !wrappers[2]) return;

        const maxSpeed = 180;
        const acceleration = 300;
        const deceleration = 200;

        let animationId: number | null = null;

        const animateRotation = (currentTime: number) => {
            if (lastTimeRef.current === 0) {
                lastTimeRef.current = currentTime;
            }

            const deltaTime = (currentTime - lastTimeRef.current) / 1000;
            lastTimeRef.current = currentTime;

            if (isHovering) {
                rotationSpeedRef.current = Math.min(
                    rotationSpeedRef.current + acceleration * deltaTime,
                    maxSpeed
                );
            } else {
                if (rotationSpeedRef.current > 0) {
                    rotationSpeedRef.current = Math.max(
                        rotationSpeedRef.current - deceleration * deltaTime,
                        0
                    );
                }

                // Return to 0 when stopped
                if (rotationSpeedRef.current === 0 && rotationRef.current !== 0) {
                    rotationRef.current = rotationRef.current % 360;

                    if (rotationRef.current > 0) {
                        const returnSpeed = Math.max(rotationRef.current * 3, 30);
                        rotationRef.current = Math.max(0, rotationRef.current - returnSpeed * deltaTime);
                    }

                    if (Math.abs(rotationRef.current) < 1) {
                        rotationRef.current = 0;
                    }
                }
            }

            // Apply rotation
            if (rotationSpeedRef.current > 0) {
                rotationRef.current += rotationSpeedRef.current * deltaTime;
            }

            // Update transforms
            wrappers.forEach((w) => {
                if (w) {
                    w.style.transition = 'none';
                    w.style.transform = `rotate(${rotationRef.current}deg)`;
                    w.style.transformOrigin = `${centerX}px ${centerY}px`;
                }
            });

            // Continue animation if needed
            if (isHovering || rotationSpeedRef.current > 0 || rotationRef.current !== 0) {
                animationId = requestAnimationFrame(animateRotation);
            } else {
                animationId = null;
                lastTimeRef.current = 0;
            }
        };

        if (isHovering || rotationSpeedRef.current > 0 || rotationRef.current !== 0) {
            lastTimeRef.current = 0;
            animationId = requestAnimationFrame(animateRotation);
        }

        return () => {
            if (animationId !== null) {
                cancelAnimationFrame(animationId);
            }
        };
    }, [isHovering, centerX, centerY]);

    const handleMouseEnter = useCallback(() => {
        setIsHovering(true);
    }, []);

    const handleMouseLeave = useCallback(() => {
        setIsHovering(false);
    }, []);

    return (
        <svg
            ref={containerRef}
            viewBox="0 0 800 800"
            xmlns="http://www.w3.org/2000/svg"
            className={className}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            style={{ cursor: 'pointer' }}
        >
            <defs>
                {/* Comma 1 - Bottom Left */}
                <clipPath id={comma1ClipId}>
                    <circle cx="220" cy="520" r="55" />
                    <path d="M 265 540 Q 268 560 255 580 Q 242 600 212 615 Q 225 595 235 575 Q 248 558 240 545 Z" />
                </clipPath>

                {/* Comma 2 - Top */}
                <clipPath id={comma2ClipId}>
                    <circle cx="400" cy="240" r="55" />
                    <path d="M 445 260 Q 448 280 435 300 Q 422 320 392 335 Q 405 315 415 295 Q 428 278 420 265 Z" />
                </clipPath>

                {/* Comma 3 - Bottom Right */}
                <clipPath id={comma3ClipId}>
                    <circle cx="580" cy="520" r="55" />
                    <path d="M 625 540 Q 628 560 615 580 Q 602 600 572 615 Q 585 595 595 575 Q 608 558 600 545 Z" />
                </clipPath>
            </defs>

            {/* Rotating comma wrappers */}
            <g ref={wrapper1Ref}>
                <g ref={comma1Ref} clipPath={`url(#${comma1ClipId})`} />
            </g>
            <g ref={wrapper2Ref}>
                <g ref={comma2Ref} clipPath={`url(#${comma2ClipId})`} />
            </g>
            <g ref={wrapper3Ref}>
                <g ref={comma3Ref} clipPath={`url(#${comma3ClipId})`} />
            </g>
        </svg>
    );
}

export default MatrixLogo;
