#!/usr/bin/env python3
"""Create PWA icons for AMarsBody Nutrition app."""

from PIL import Image, ImageDraw
import os

# Brand colors
ORANGE = (249, 115, 22)  # #f97316
CHARCOAL = (28, 25, 23)  # #1c1917
CREAM = (250, 250, 249)  # #fafaf9

def create_icon(size, output_path):
    """Create a simple icon with the AMarsBody branding."""
    img = Image.new('RGB', (size, size), CHARCOAL)
    draw = ImageDraw.Draw(img)
    
    # Calculate sizes
    padding = size // 8
    center = size // 2
    
    # Draw orange circle (representing the logo glow)
    circle_radius = size // 3
    draw.ellipse(
        [center - circle_radius, center - circle_radius,
         center + circle_radius, center + circle_radius],
        fill=ORANGE
    )
    
    # Draw a simplified dumbbell/fitness symbol using lines
    bar_width = size // 3
    bar_height = size // 12
    bar_top = center - bar_height // 2
    
    # Left weight
    draw.rectangle([center - bar_width//2 - size//10, bar_top, center - bar_width//2, bar_top + bar_height], fill=CREAM)
    # Right weight  
    draw.rectangle([center + bar_width//2, bar_top, center + bar_width//2 + size//10, bar_top + bar_height], fill=CREAM)
    # Bar
    draw.rectangle([center - bar_width//2, center - size//60, center + bar_width//2, center + size//60], fill=CREAM)
    
    img.save(output_path, 'PNG')
    print(f"Created {output_path}")

def main():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    public_dir = os.path.join(os.path.dirname(script_dir), 'public')
    
    os.makedirs(public_dir, exist_ok=True)
    
    # Create icons
    create_icon(192, os.path.join(public_dir, 'icon-192.png'))
    create_icon(512, os.path.join(public_dir, 'icon-512.png'))
    
    print("PWA icons created successfully!")

if __name__ == '__main__':
    main()
